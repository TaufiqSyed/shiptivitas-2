import express from 'express';
import Database from 'better-sqlite3';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  return res.status(200).send({ 'message': 'SHIPTIVITY API. Read documentation to see API docs' });
});

// We are keeping one connection alive for the rest of the life application for simplicity
const db = new Database('./clients.db');

// Don't forget to close connection when server gets terminated
const closeDb = () => db.close();
process.on('SIGTERM', closeDb);
process.on('SIGINT', closeDb);

/**
 * Validate id input
 * @param {any} id
 */
const validateId = (id) => {
  if (Number.isNaN(id)) {
    return {
      valid: false,
      messageObj: {
        'message': 'Invalid id provided.',
        'long_message': 'Id can only be integer.',
      },
    };
  }
  const client = db.prepare('select * from clients where id = ? limit 1').get(id);
  if (!client) {
    return {
      valid: false,
      messageObj: {
        'message': 'Invalid id provided.',
        'long_message': 'Cannot find client with that id.',
      },
    };
  }
  return {
    valid: true,
  };
}

/**
 * Validate priority input
 * @param {any} priority
 */
const validatePriority = (priority) => {
  if (Number.isNaN(priority) && priority) {
    return {
      valid: false,
      messageObj: {
        'message': 'Invalid priority provided.',
        'long_message': 'Priority can only be positive integer.',
      },
    };
  }
  return {
    valid: true,
  }
}

/**
 * Get all of the clients. Optional filter 'status'
 * GET /api/v1/clients?status={status} - list all clients, optional parameter status: 'backlog' | 'in-progress' | 'complete'
 */
app.get('/api/v1/clients', (req, res) => {
  const status = req.query.status;
  if (status) {
    // status can only be either 'backlog' | 'in-progress' | 'complete'
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    const clients = db.prepare('select * from clients where status = ?').all(status);
    return res.status(200).send(clients);
  }
  const statement = db.prepare('select * from clients');
  const clients = statement.all();
  return res.status(200).send(clients);
});

/**
 * Get a client based on the id provided.
 * GET /api/v1/clients/{client_id} - get client by id
 */
app.get('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    res.status(400).send(messageObj);
  }
  return res.status(200).send(db.prepare('select * from clients where id = ?').get(id));
});

/**
 * Update client information based on the parameters provided.
 * When status is provided, the client status will be changed
 * When priority is provided, the client priority will be changed with the rest of the clients accordingly
 * Note that priority = 1 means it has the highest priority (should be on top of the swimlane).
 * No client on the same status should not have the same priority.
 * This API should return list of clients on success
 *
 * PUT /api/v1/clients/{client_id} - change the status of a client
 *    Data:
 *      status (optional): 'backlog' | 'in-progress' | 'complete',
 *      priority (optional): integer,
 *
 */
app.put('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  let valid, messageObj
  ({ valid, messageObj } = validateId(id));
  if (!valid) res.status(400).send(messageObj)

  let { status, priority } = req.body;
  let clients = db.prepare('select * from clients').all();
  const originalClient = clients.find(client => client.id === id);

  if (status) {
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
  } else {
    status = originalClient.status
  }

  // if no changes made, clients sent with no update to database

  const maxPriority = clients.filter(client => client.status === status).length + 1
  if (!priority) {
    if (originalClient.status === status) return res.status(200).send(clients)
    priority = maxPriority
  }

  ({ valid, messageObj } = validatePriority(priority))
  if (!valid) return res.status(400).send(messageObj);
  if (originalClient.status === status) {
    if (originalClient.priority === priority) return res.status(200).send(clients)
    // mapping clients to reflect shifting of cards
    // this is shifting between a single swimlane
    clients.map(client => {
      if (client.status !== status) return
      if (priority <= client.priority < originalClient.priority) {
        client.priority = client.priority + 1
      } else if (priority >= client.priority > originalClient.priority) {
        client.priority = client.priority - 1
      }
    })
  } else {
    // mapping clients to reflect shifting of cards
    // this is shifting between two different swimlanes
    clients.map(client => {
      if (client.status === originalClient.status) {
        // swimlane from where card is being picked
        if (client.priority >= originalClient.priority) {
          client.priority = client.priority - 1
        }
      } else if (client.status === status) {
        // swimlane where card is being placed
        if (client.priority >= priority) {
          client.priority = client.priority + 1
        }
      }
    })
  }
  // fixing priority of exceeded size
  if (priority > maxPriority) priority = maxPriority

  const updatedClient = {
    ...originalClient,
    status: status, 
    priority: priority
  }
  // updating moved client in clients
  clients = clients.map(client => {
    return client.id === id ? updatedClient : client
  })

  // creating function for updating database
  const updateClient = db.prepare(
    'UPDATE clients SET status = ?, priority = ? WHERE id = ?'
  )
  const updateAllClients = clients => {
    clients.forEach((client) => {
      updateClient.run(client.status, client.priority, client.id)
    })
  }
  updateAllClients(clients)

  return res.status(200).send(clients);
});

app.listen(3001);
console.log('app running on port ', 3001);