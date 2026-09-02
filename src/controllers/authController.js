import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'lankaexpressway_jwt_secret_key_2026_lk', {
    expiresIn: '30d',
  });
};

// Helper to ensure Wallet exists & get authoritative balance
const getAuthoritativeWalletBalance = async (user) => {
  let wallet = await Wallet.findOne({ userId: user._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: user._id,
      userStrId: user.userId || user._id.toString(),
      balance: 0,
      currency: 'LKR',
      status: 'ACTIVE',
    });
  } else {
    const hasCompletedTopup = await WalletTransaction.findOne({
      userId: user._id,
      status: 'COMPLETED',
      type: 'CREDIT',
    });
    if (!hasCompletedTopup && wallet.balance > 0) {
      wallet.balance = 0;
      await wallet.save();
    }
  }
  if (user.walletBalance !== wallet.balance) {
    user.walletBalance = wallet.balance;
    await user.save();
  }
  return wallet.balance;
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Please contact admin.' });
    }

    const balance = await getAuthoritativeWalletBalance(user);

    res.json({
      id: user.userId,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      adminPermissions: user.adminPermissions || [],
      assignedBuses: user.assignedBuses || [],
      conductorPermissions: user.conductorPermissions || {},
      walletBalance: balance,
      token: generateToken(user._id),
    });
  } catch (err) {
    next(err);
  }
};

// Validation Helpers
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

export const isValidSriLankanPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^(?:\+94|0)?7[0-8]\d{7}$/;
  return phoneRegex.test(cleanPhone);
};

// @desc    Register new passenger
// @route   POST /api/auth/register
export const registerUser = async (req, res, next) => {
  try {
    const { email, password, phone } = req.body;
    const name = req.body.name || req.body.fullName || 'Passenger User';

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address (e.g. name@example.com)' });
    }

    if (!phone || !isValidSriLankanPhone(phone)) {
      return res.status(400).json({ error: 'Please provide a valid Sri Lankan phone number (e.g. 0771234567 or +94 77 123 4567)' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate guaranteed unique Customer ID (collision-free timestamp + random string)
    let userId = `cust_${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
    let collisionCount = 0;
    while ((await User.exists({ userId })) && collisionCount < 10) {
      userId = `cust_${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
      collisionCount++;
    }

    const user = await User.create({
      userId,
      name,
      email: email.toLowerCase().trim(),
      password,
      phone: phone.trim(),
      role: 'user',
      walletBalance: 0,
    });

    // Authoritative Wallet record creation
    const wallet = await Wallet.create({
      userId: user._id,
      userStrId: user.userId,
      balance: 0,
      currency: 'LKR',
      status: 'ACTIVE',
    });

    res.status(201).json({
      id: user.userId,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      walletBalance: wallet.balance,
      token: generateToken(user._id),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Initiate Forgot Password (Check Email & Generate OTP)
// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address' });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expireTime = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordToken = otp;
    user.resetPasswordExpire = expireTime;
    await user.save();

    console.log(`📧 [PASSWORD RESET OTP] Code for ${user.email}: ${otp}`);

    res.json({
      success: true,
      message: `Password reset code generated for ${user.email}.`,
      email: user.email,
      otp: otp, // Returned for instant user convenience
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Complete Password Reset with OTP & New Password
// @route   POST /api/auth/reset-password
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Please provide email, reset code, and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: otp.trim(),
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset code. Please request a new code.' });
    }

    // Update password (pre-save hook will hash password automatically)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all users (Admin)
// @route   GET /api/users
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const wallets = await Wallet.find();
    
    const transformed = users.map((u) => {
      const userWallet = wallets.find(w => w.userId.toString() === u._id.toString());
      return {
        id: u.userId,
        _id: u._id,
        userId: u.userId,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        walletBalance: userWallet ? userWallet.balance : (u.walletBalance || 0),
        status: u.status,
        createdAt: u.createdAt,
      };
    });
    res.json(transformed);
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id/profile
export const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({
      $or: [{ userId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;
    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();
    const balance = await getAuthoritativeWalletBalance(updatedUser);

    res.json({
      id: updatedUser.userId,
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      walletBalance: balance,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user status (Admin: Active/Suspended)
// @route   PUT /api/users/:id/status
export const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findOneAndUpdate(
      { $or: [{ userId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }] },
      { status },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle user role (Admin: admin/user)
// @route   PUT /api/users/:id/role
export const toggleUserRole = async (req, res, next) => {
  try {
    const user = await User.findOne({
      $or: [{ userId: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.role = user.role === 'admin' ? 'user' : 'admin';
    await user.save();

    res.json(user);
  } catch (err) {
    next(err);
  }
};
