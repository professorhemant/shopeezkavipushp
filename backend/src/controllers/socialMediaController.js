'use strict';

const axios = require('axios');
const { SocialPost, SocialSetting } = require('../models');

const getSettings = async (req, res) => {
  try {
    const settings = await SocialSetting.findOne({ where: { firm_id: req.firmId } });
    res.json({ success: true, settings: settings || null });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const saveSettings = async (req, res) => {
  try {
    const { fb_page_id, fb_page_access_token, ig_account_id } = req.body;
    let settings = await SocialSetting.findOne({ where: { firm_id: req.firmId } });
    if (settings) {
      await settings.update({ fb_page_id, fb_page_access_token, ig_account_id });
    } else {
      settings = await SocialSetting.create({
        firm_id: req.firmId,
        fb_page_id,
        fb_page_access_token,
        ig_account_id,
      });
    }
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const listPosts = async (req, res) => {
  try {
    const posts = await SocialPost.findAll({
      where: { firm_id: req.firmId },
      order: [['created_at', 'DESC']],
      limit: 200,
    });
    res.json({ success: true, posts });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/social/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const createPost = async (req, res) => {
  try {
    const { image_url, caption, platform } = req.body;
    if (!image_url) return res.status(400).json({ success: false, message: 'image_url is required' });
    if (!platform) return res.status(400).json({ success: false, message: 'platform is required' });

    const settings = await SocialSetting.findOne({ where: { firm_id: req.firmId } });
    if (!settings) {
      return res.status(400).json({
        success: false,
        message: 'Social media not configured. Go to the Settings tab and add your Meta credentials first.',
      });
    }

    const post = await SocialPost.create({
      firm_id: req.firmId,
      image_url,
      caption: caption || '',
      platform,
      status: 'pending',
    });

    let fbPostId = null;
    let igMediaId = null;
    const errors = [];

    // ── Facebook ───────────────────────────────────────────────────────
    if (platform === 'facebook' || platform === 'both') {
      if (!settings.fb_page_id || !settings.fb_page_access_token) {
        errors.push('Facebook: Page ID or Access Token not configured');
      } else {
        try {
          const fbRes = await axios.post(
            `https://graph.facebook.com/v20.0/${settings.fb_page_id}/photos`,
            null,
            {
              params: {
                url: image_url,
                message: caption || '',
                access_token: settings.fb_page_access_token,
              },
              timeout: 30000,
            }
          );
          fbPostId = fbRes.data.id || fbRes.data.post_id || null;
        } catch (e) {
          const msg = e.response?.data?.error?.message || e.message;
          errors.push(`Facebook: ${msg}`);
        }
      }
    }

    // ── Instagram ──────────────────────────────────────────────────────
    if (platform === 'instagram' || platform === 'both') {
      if (!settings.ig_account_id || !settings.fb_page_access_token) {
        errors.push('Instagram: Account ID or Access Token not configured');
      } else {
        try {
          // Step 1 — create media container
          const containerRes = await axios.post(
            `https://graph.facebook.com/v20.0/${settings.ig_account_id}/media`,
            null,
            {
              params: {
                image_url,
                caption: caption || '',
                access_token: settings.fb_page_access_token,
              },
              timeout: 30000,
            }
          );
          const creationId = containerRes.data.id;

          // Step 2 — publish
          const publishRes = await axios.post(
            `https://graph.facebook.com/v20.0/${settings.ig_account_id}/media_publish`,
            null,
            {
              params: {
                creation_id: creationId,
                access_token: settings.fb_page_access_token,
              },
              timeout: 30000,
            }
          );
          igMediaId = publishRes.data.id || null;
        } catch (e) {
          const msg = e.response?.data?.error?.message || e.message;
          errors.push(`Instagram: ${msg}`);
        }
      }
    }

    const anySuccess = fbPostId || igMediaId;
    const status = anySuccess ? 'posted' : 'failed';

    await post.update({
      status,
      fb_post_id: fbPostId,
      ig_media_id: igMediaId,
      error_message: errors.length ? errors.join('; ') : null,
      posted_at: anySuccess ? new Date() : null,
    });

    res.json({
      success: true,
      post,
      posted: { facebook: !!fbPostId, instagram: !!igMediaId },
      errors: errors.length ? errors : null,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await SocialPost.findOne({ where: { id: req.params.id, firm_id: req.firmId } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    await post.destroy();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getSettings, saveSettings, listPosts, uploadImage, createPost, deletePost };
