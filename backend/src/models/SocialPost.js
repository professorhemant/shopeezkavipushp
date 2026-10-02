'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SocialPost = sequelize.define('SocialPost', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  firm_id: { type: DataTypes.INTEGER, allowNull: false },
  image_url: { type: DataTypes.TEXT, allowNull: false },
  caption: { type: DataTypes.TEXT, allowNull: true },
  platform: { type: DataTypes.ENUM('instagram', 'facebook', 'both'), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'posted', 'failed'), defaultValue: 'pending' },
  fb_post_id: { type: DataTypes.STRING(300), allowNull: true },
  ig_media_id: { type: DataTypes.STRING(300), allowNull: true },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  posted_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'social_posts',
  underscored: true,
  timestamps: true,
});

module.exports = SocialPost;
