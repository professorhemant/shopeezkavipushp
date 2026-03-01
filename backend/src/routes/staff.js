'use strict';

const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

// Permissions (no :id, must be before /:id patterns)
router.get('/permissions', staffController.getPermissions);

// Roles
router.get('/roles', staffController.getRoles);
router.post('/roles', staffController.createRole);
router.put('/roles/:id', staffController.updateRole);
router.delete('/roles/:id', staffController.deleteRole);

// Staff CRUD
router.get('/', staffController.getAll);
router.post('/', staffController.create);

router.get('/:id', staffController.getOne);
router.put('/:id', staffController.update);
router.delete('/:id', staffController.remove);
router.post('/:id/deactivate', staffController.deactivate);
router.post('/:id/reactivate', staffController.reactivate);

module.exports = router;
