'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/promotionController');
const upload = require('../middleware/upload');

const setFolder = (req, res, next) => { req.uploadFolder = 'promotions'; next(); };
const uploadImages = [setFolder, upload.array('images', 10)];

router.get('/',           c.getAll);
router.post('/',          uploadImages, c.create);
router.get('/:id',        c.getOne);
router.put('/:id',        uploadImages, c.update);
router.put('/:id/return', c.markReturned);
router.delete('/:id',     c.remove);

module.exports = router;
