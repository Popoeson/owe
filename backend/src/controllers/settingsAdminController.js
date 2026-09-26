const Settings = require('../models/Settings');

async function getSettings(req, res, next) {
  try {
    res.json(await Settings.getSingleton());
  } catch (err) { next(err); }
}

async function updateSettings(req, res, next) {
  try {
    const { votePrice, votingOpen } = req.body;
    const settings = await Settings.getSingleton();

    if (votePrice !== undefined) {
      if (typeof votePrice !== 'number' || votePrice <= 0) {
        return res.status(400).json({ error: 'votePrice must be a positive number (in kobo)' });
      }
      settings.votePrice = votePrice;
    }
    if (votingOpen !== undefined) {
      settings.votingOpen = !!votingOpen;
    }

    await settings.save();
    res.json(settings);
  } catch (err) { next(err); }
}

module.exports = { getSettings, updateSettings };