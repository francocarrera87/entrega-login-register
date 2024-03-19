const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const exphbs = require('express-handlebars');
const messageModel = require('./dao/models/message');
const authMiddleware = require('./public/js/authMiddleware');
const User = require('./dao/models/users');

// ## DB
mongoose.connect('mongodb+srv://hola1234:hola1234@clustercoder.k5czlhe.mongodb.net/ecommerce').then(() => {
  console.log('Conectado a la red de Atlas');
});

// ## Manejador de Items
const ItemsManager = require('./dao/dbManagers/ItemManager');
const manager = new ItemsManager();

// ## WebSockets
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const port = 8080;


// ## Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ## Plantillas Handlebars
const hbs = exphbs.create({
  defaultLayout: 'main',
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
  },
});

app.engine('handlebars', hbs.engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'handlebars');
app.use(express.static(path.join(__dirname, 'public')));

// ## WebSockets (Eventos)
io.on('connection', async (socket) => {
  console.log('Socket connected');

  // ## Items
  socket.on('new item', async (newItem) => {
    await manager.addItem(newItem);
    const items = await manager.getItems();
    io.emit('list updated', items);
  });

  socket.on('delete item', async ({ id }) => {
    await manager.deleteItem(id);
    const items = await manager.getItems();
    io.emit('list updated', items);
    io.emit('item deleted', id);
  });

  // ## Chat
  const messages = await messageModel.find().lean();
  io.emit('chat messages', { messages });

  socket.on('new message', async (messageInfo) => {
    await messageModel.create(messageInfo);
    const updatedMessages = await messageModel.find().lean();
    io.emit('chat messages', { messages: updatedMessages });
  });
});

// ## Middleware para pasar el socket.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ## Rutas (todas con async/await)
authMiddleware(app);
app.get('/', authMiddleware, async (req, res) => { 
  const items = await manager.getItems();
  res.render('', { items });
});

app.get('/table', authMiddleware, async (req, res) => { 
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 5;
  const items = await manager.getItemsPaginated(page, limit);
  res.render('table', { items: items.docs, ...items });
});

app.get('/chat', authMiddleware, async (req, res) => { 
  res.render('chat', {});
});

// ## Rutas de Login y Registro (con async/await)

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const usuario = await findUserByEmailAndPassword(email, password);
  if (usuario) {
    req.session.usuario = usuario;
    res.redirect('/');
  } else {
    req.session.flash = {
      type: 'error',
      message: 'Credenciales incorrectas.',
    };
    res.render('login');
  }
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const usuario = await createUser(name, email, password);

  if (usuario) {
    req.session.flash = {
      type: 'success',
      message: 'Usuario creado correctamente.',
    };
    
    res.redirect('/login');
  } else {
    req.session.flash = {
      type: 'error',
      message: 'Error al crear el usuario. Inténtalo de nuevo.',
    };
    res.render('register');
  }
});

// ## Inicio del servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

// ## Funciones adicionales

async function findUserByEmailAndPassword(email, password) {
  const user = await User.findOne({ email });

  if (!user) {
    return null;
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return null;
  }

  return user;
}

async function createUser(name, email, password) {
  try {
    const user = new User({ name, email, password });
    await user.save();
    return user;
  } catch (err) {
    if (err.code === 11000) {
      // error cuando el email ya está registrado
      return null;
    }
    throw err;
  }
}