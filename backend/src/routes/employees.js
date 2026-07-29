'use strict';

const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const c = require('../controllers/employeeController');

// Salary/payroll data is sensitive — admins only.
router.use(authorize('super_admin', 'admin'));

// Employees
router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

// Payroll entries (salary / advance / incentive / deduction)
router.post('/:id/payroll', c.addEntry);
router.put('/payroll/:entryId', c.updateEntry);
router.delete('/payroll/:entryId', c.deleteEntry);

// Monthly leave count
router.put('/:id/leave', c.setLeave);

module.exports = router;
