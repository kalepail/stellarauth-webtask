import Datastore from '@google-cloud/datastore';
import credentials from '../credentials';

const datastore = new Datastore({ credentials });

export function insert(kind, id, data = {}) {
  const user = {
    key: datastore.key([kind, id]),
    data,
  }

  return datastore
  .insert(user)
  .catch(err => {throw err});
}

export function get(kind, id) {
  const key = datastore.key([kind, id]);

  return datastore
  .get(key)
  .then((user) => user[0])
  .catch(err => {throw err});
}

export function update(kind, id, data = {}) {
  const user = {
    key: datastore.key([kind, id]),
    data,
  }

  return datastore
  .update(user)
  .catch(err => {throw err});
}
