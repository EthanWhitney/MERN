const express = require('express');
const router = express.Router();
const { createServer, getServer, updateServer, deleteServer } = require('../controllers/serverController');
 
// POST /api/servers
router.post('/', createServer);
 
// GET /api/servers/:serverId
router.get('/:serverId', getServer);
 
// PATCH /api/servers/:serverId
router.patch('/:serverId', updateServer);
 
// DELETE /api/servers/:serverId
router.delete('/:serverId', deleteServer);
 
module.exports = router;