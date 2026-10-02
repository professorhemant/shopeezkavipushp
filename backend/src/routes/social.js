'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/socialMediaController');
const upload = require('../middleware/upload');

router.get('/settings', ctrl.getSettings);
router.post('/settings', ctrl.saveSettings);
router.get('/posts', ctrl.listPosts);
router.post(
  '/upload',
  (req, res, next) => { req.uploadFolder = 'social'; next(); },
  upload.single('image'),
  ctrl.uploadImage
);
router.post('/posts', ctrl.createPost);
router.delete('/posts/:id', ctrl.deletePost);

module.exports = router;
