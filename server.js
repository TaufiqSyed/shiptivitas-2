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

const resetDatabaseStatements = `DROP TABLE clients;
CREATE TABLE IF NOT EXISTS clients ( id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT, priority INTEGER );
insert into clients values(1,"Stark, White and Abbott", "Cloned Optimal Architecture", "in-progress", 1);
insert into clients values(2,"Wiza LLC", "Exclusive Bandwidth-Monitored Implementation", "complete", 1);
insert into clients values(3,"Nolan LLC", "Vision-Oriented 4Thgeneration Graphicaluserinterface", "backlog", 1);
insert into clients values(4,"Thompson PLC", "Streamlined Regional Knowledgeuser", "in-progress", 2);
insert into clients values(5,"Walker-Williamson", "Team-Oriented 6Thgeneration Matrix", "in-progress", 3);
insert into clients values(6,"Boehm and Sons", "Automated Systematic Paradigm", "backlog", 2);
insert into clients values(7,"Runolfsson, Hegmann and Block", "Integrated Transitional Strategy", "backlog", 3);
insert into clients values(8,"Schumm-Labadie", "Operative Heuristic Challenge", "backlog", 4);
insert into clients values(9,"Kohler Group", "Re-Contextualized Multi-Tasking Attitude", "backlog", 5);
insert into clients values(10,"Romaguera Inc", "Managed Foreground Toolset", "backlog", 6);
insert into clients values(11,"Reilly-King", "Future-Proofed Interactive Toolset", "complete", 2);
insert into clients values(12,"Emard, Champlin and Runolfsdottir", "Devolved Needs-Based Capability", "backlog", 7);
insert into clients values(13,"Fritsch, Cronin and Wolff", "Open-Source 3Rdgeneration Website", "complete", 3);
insert into clients values(14,"Borer LLC", "Profit-Focused Incremental Orchestration", "backlog", 8);
insert into clients values(15,"Emmerich-Ankunding", "User-Centric Stable Extranet", "in-progress", 4);
insert into clients values(16,"Willms-Abbott", "Progressive Bandwidth-Monitored Access", "in-progress", 5);
insert into clients values(17,"Brekke PLC", "Intuitive User-Facing Customerloyalty", "complete", 4);
insert into clients values(18,"Bins, Toy and Klocko", "Integrated Assymetric Software", "backlog", 9);
insert into clients values(19,"Hodkiewicz-Hayes", "Programmable Systematic Securedline", "backlog", 10);
insert into clients values(20,"Murphy, Lang and Ferry", "Organized Explicit Access", "backlog", 11);`.split(/\r?\n/).map(
  sql => db.prepare(sql)
)

const resetDatabase = db.transaction(() => {
  for (const stmt of resetDatabaseStatements) stmt.run()
})


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
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    res.status(400).send(messageObj);
  }

  let { status, priority } = req.body;
  let clients = db.prepare('select * from clients').all();
  const originalClient = clients.find(client => client.id === id);

  /* ---------- Update code below ----------*/
  let updatedClient = { ...originalClient}
  if (status) {
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {  
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    updatedClient.status = status
  } else {
    status = originalClient.status
  }

  if (priority) {
    const { valid, messageObj } = validatePriority(priority)
    if (!valid) return res.status(400).send(messageObj);
    if (originalClient.status === status) {
      if (originalClient.priority === priority) return
      clients.map(client => {
        if (client.status !== status) return
        if (priority <= client.priority < originalClient.priority) {
          client.priority = client.priority + 1
        } else if (priority >= client.priority > originalClient.priority) {
          client.priority = client.priority - 1
        }
      })
    } else {
      clients.map(client => {
        if (client.status === originalClient.status) {
          if (client.priority > originalClient.priority) {
            client.priority = client.priority - 1
          }
        } else if (client.status === status) {
          if (client.priority >= priority) {
            client.priority = client.priority + 1
          }
        }
      })
    }
  } else {
    if (status = originalClient.status) return
    priority = clients.filter(client => client !== status).length
  }
  updatedClient.priority = priority
  clients = clients.map(client => {
    return client.id === id ? updatedClient : client
  })

  // clients array is correct

  const updateClient = db.prepare(
    'UPDATE clients SET status = ?, priority = ? WHERE id = ?'
  )
  const updateAllClients = clients => {
    clients.forEach((client) => {
      updateClient.run( client.status, client.priority, client.id )
    })
  }

  updateAllClients(clients)
  
  return res.status(200).send(clients);
});

app.listen(3001);
console.log('app running on port ', 3001);
