'use strict';

const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { User, Firm } = require('../models');

const OWNER_EMAIL = 'arthav12@gmail.com';

const createTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOtpEmail = async (otp, context = '') => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[OTP] SMTP not configured. OTP${context ? ' (' + context + ')' : ''}: ${otp}`);
    return;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Kavipushp Jewels" <${process.env.SMTP_USER}>`,
      to: OWNER_EMAIL,
      subject: `Your OTP: ${otp}`,
      text: `Your Kavipushp Jewels OTP${context ? ' for ' + context : ''} is: ${otp}\n\nValid for 10-15 minutes. Do not share with anyone.`,
    });
  } catch (err) {
    console.error('Email OTP send failed:', err.message);
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'shopeezkavi_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper: generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper: sign JWT
const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * POST /auth/register
 * Creates a new Firm + admin User
 */
const register = async (req, res, next) => {
  try {
    const {
      firm_name,
      firm_email,
      firm_phone,
      firm_address,
      gstin,
      name,
      email,
      phone,
      password,
    } = req.body;

    if (!firm_name || !name || !email || !password) {
      return res.status(400).json({ success: false, message: 'firm_name, name, email and password are required.' });
    }

    // Check duplicate email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Create firm
    const firm = await Firm.create({
      name: firm_name,
      email: firm_email || email,
      phone: firm_phone || phone,
      address: firm_address || null,
      gstin: gstin || null,
      is_active: true,
    });

    // Create admin user (beforeCreate hook in User model handles hashing)
    const user = await User.create({
      firm_id: firm.id,
      name,
      email,
      phone: phone || null,
      password,
      role_name: 'admin',
      is_active: true,
    });

    const token = signToken({ id: user.id, firm_id: firm.id, role: user.role_name });

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role_name: user.role_name,
        firm: {
          id: firm.id,
          name: firm.name,
          gstin: firm.gstin,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/login
 * Login with email/phone + password, returns JWT
 */
const login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;

    if (!password || (!email && !phone)) {
      return res.status(400).json({ success: false, message: 'Email or phone and password are required.' });
    }

    const whereClause = email ? { email } : { phone };
    const user = await User.findOne({
      where: { ...whereClause, is_active: true },
      include: [{ model: Firm, as: 'firm' }],
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = signToken({ id: user.id, firm_id: user.firm_id, role: user.role_name });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role_name: user.role_name,
        firm: user.firm
          ? {
              id: user.firm.id,
              name: user.firm.name,
              email: user.firm.email,
              phone: user.firm.phone,
              address: user.firm.address,
              gstin: user.firm.gstin,
              logo: user.firm.logo,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/forgot-password
 * Generate OTP and store in user record
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ where: { email, is_active: true } });
    if (!user) {
      // Don't reveal whether user exists
      return res.status(200).json({ success: true, message: 'If that email exists, an OTP has been sent.' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await user.update({ otp, otp_expires: otpExpires });

    await sendOtpEmail(otp, `forgot password for ${email}`);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to registered email.',
      // In development, expose OTP; remove in production
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password
 * Verify OTP and update password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;

    if (!email || !otp || !new_password) {
      return res.status(400).json({ success: false, message: 'email, otp and new_password are required.' });
    }

    const user = await User.findOne({
      where: {
        email,
        otp,
        otp_expires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    await user.update({ password: new_password, otp: null, otp_expires: null });

    return res.status(200).json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /auth/change-password  (authenticated)
 * Change own password
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'current_password and new_password are required.' });
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    await user.update({ password: new_password });

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/profile  (authenticated)
 * Return current user with firm data
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ['password', 'otp', 'otp_expires'] },
      include: [{ model: Firm, as: 'firm' }],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /auth/profile  (authenticated)
 * Update name, phone, avatar
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;

    await user.update(updates);

    const updatedUser = await User.findByPk(req.userId, {
      attributes: { exclude: ['password', 'otp', 'otp_expires'] },
      include: [{ model: Firm, as: 'firm' }],
    });

    return res.status(200).json({ success: true, message: 'Profile updated.', data: updatedUser });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/request-edit-otp  (authenticated)
 * Generate OTP for edit action, store on user record
 */
const requestEditOtp = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.update({ otp, otp_expires: otpExpires });

    const phone = user.phone || '';
    const maskedPhone = phone.length >= 4
      ? phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4)
      : '****';

    await sendOtpEmail(otp, `edit by ${user.email}`);

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${maskedPhone}`,
      maskedPhone,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/verify-edit-otp  (authenticated)
 * Verify OTP for edit action
 */
const verifyEditOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required.' });

    const user = await User.findOne({
      where: {
        id: req.userId,
        otp,
        otp_expires: { [Op.gt]: new Date() },
      },
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });

    await user.update({ otp: null, otp_expires: null });
    return res.status(200).json({ success: true, message: 'OTP verified.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, forgotPassword, resetPassword, changePassword, getProfile, updateProfile, requestEditOtp, verifyEditOtp };
