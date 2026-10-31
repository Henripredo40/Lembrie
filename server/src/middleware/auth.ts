const jwt = require('jsonwebtoken');

module.exports = function createAuth(secret) {
  return (req, res, next) => {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    try {
      req.user = jwt.verify(authorization.slice(7), secret);
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  };
};
