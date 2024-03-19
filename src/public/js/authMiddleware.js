const expressSession = require('express-session');

const flash = require('connect-flash');

// Configuración de sesiones

const sessionConfig = {

  secret: 'perrito',

  resave: false,

  saveUninitialized: false,

};

// Middleware de autenticación

const auth = async (req, res, next) => {

  try {

    if (req.session && req.session.usuario) {

      next();

    } else {

      throw new Error('No estás autenticado');

    }

  } catch (error) {

    req.session.flash = {

      type: 'error',

      message: error.message,

    };

    if (req.path !== '/login' && req.path !== '/register') {

      return res.redirect('/login');

    }

    next();

  }

};

module.exports = (app) => {

  app.use(expressSession(sessionConfig));

  app.use(flash());

  app.use(auth);

};