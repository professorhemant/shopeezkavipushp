'use strict';

const express = require('express');
const router = express.Router();
const c = require('../controllers/promotionController');

router.get('/',           c.getAll);
router.post('/',          c.create);
router.get('/:id',        c.getOne);
router.put('/:id',        c.update);
router.put('/:id/return', c.markReturned);
router.delete('/:id',     c.remove);

module.exports = router;
