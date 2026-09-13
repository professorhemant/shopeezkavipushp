'use strict';
const { ChatbotRule } = require('../models');

exports.getRules = async (req, res) => {
  try {
    const rules = await ChatbotRule.findAll({
      where: { firm_id: req.firmId, active: true },
      order: [['created_at', 'ASC']],
    });
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveRules = async (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ success: false, message: 'rules must be an array' });

    // Replace all rules for this firm
    await ChatbotRule.destroy({ where: { firm_id: req.firmId } });
    if (rules.length > 0) {
      await ChatbotRule.bulkCreate(
        rules.map(r => ({ firm_id: req.firmId, keyword: r.keyword, reply: r.reply, active: true }))
      );
    }
    res.json({ success: true, message: 'Rules saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
