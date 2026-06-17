'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/promotionController');
const upload = require('../middleware/upload');

const setFolder = (req, res, next) => { req.uploadFolder = 'promotions'; next(); };
const uploadImage = [setFolder, upload.single('image')];

router.get('/',           c.getAll);
router.post('/',          uploadImage, c.create);
router.get('/:id',        c.getOne);
router.put('/:id',        uploadImage, c.update);
router.put('/:id/return', c.markReturned);
router.delete('/:id',     c.remove);

module.exports = router;
