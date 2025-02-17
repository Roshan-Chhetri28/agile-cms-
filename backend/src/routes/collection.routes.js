import { Router } from 'express'
import CollectionManager from '../controllers/CollectionManager.js'

const collectionRouter = Router()

/*
 **
 ** Create a new collection (table)
 **
 ** Example Request Body:
 ** {
 **   "tableName": "users",
 **   "schema": {
 **     "name": { "type": "TEXT", "constraints": "NOT NULL" },
 **     "age": { "type": "INTEGER", "constraints": "DEFAULT 18" }
 **   }
 ** }
 **
 */
collectionRouter.post('/create', CollectionManager.createTable)

/*
 **
 ** Insert data into an existing collection
 **
 ** Example Request Body:
 ** {
 **   "tableName": "test",
 **   "data": {
 **     "test_title": "this is a test title",
 **     "test_content": 1
 **   }
 ** }
 **
 */
collectionRouter.post('/insert', CollectionManager.insertData)

/*
 **
 ** Update a record in a collection
 **
 ** Example Request Body:
 ** {
 **   "tableName": "test",
 **   "id": 1,
 **   "updateData": {
 **     "test_title": "this is an updated title",
 **     "test_content": 2
 **   }
 ** }
 **
 */
collectionRouter.put('/update', CollectionManager.updateData)

/*
 **
 ** Delete a record from a collection
 **
 ** Example Request Body:
 ** {
 **   "tableName": "test",
 **   "id": 1
 ** }
 **
 */
collectionRouter.delete('/delete', CollectionManager.deleteData)

export default collectionRouter
