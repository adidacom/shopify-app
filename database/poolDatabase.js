var extend = require('lodash').assign;
var fs = require('fs');
var mysqlConnector = require('./mysqlConnector');

function insert(databaseName, tableName, insertString, callback){
    /**
     * Inserts some data into a given tablename.
     * @param tableName:{String}: Name of table where to insert data.
     * @param insertString:{String}: The last part of the MYSQL-query with names of columns and their values.
     *                      Example: insertString: "userid = 12, name = 'Simon'"
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if(err){
            return callback(err, null);
        }
        var insertQuery = "INSERT INTO "+tableName+" SET " + insertString;
        connection.query(insertQuery, callback);
        connection.release();
    });
}


function select(databaseName, tableName, key, value, callback) {
    /**
     * Fetches one row from the given table with some key having a certain value.
     * @param tableName:{String}: The table to fetch the row from.
     * @param key:{String}: What column name to correspond to the given value.
     * @param value{String}: The value you want to fetch the row from.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if(err){
            return callback(err);
        }
        var query = "SELECT * FROM "+tableName+" WHERE "+key+" = '"+value+"'";

        console.log("Database.select: Query:", query, "Database:", databaseName);
        connection.query(
            query, function (err, results) {
                if (err) {
                    console.log("Database.select: Query:", query, "Database:", databaseName, "<ERROR>", err);
                    return callback(err);
                }
                console.log("Database.select: Query:", query, "Database:", databaseName, "<DONE>");
                if (!results.length) {
                    return callback({
                        code: 404,
                        message: 'Not found'
                    });
                }
                callback(undefined, results[0]);
            });
        connection.release();
    });
}

function selectMultiple(databaseName, tableName, key, value, callback) {
    /**
     * Selects all the rows from a given table where the key-column value corresponds to the given value.
     * @param tableName:{String}: Name of the table to fetch the rows from.
     * @param key:{String}: Name of the column to compare against the value.
     * @param value:{String}: Value to check each row for.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        var sqlQuery = "SELECT * FROM "+tableName+" WHERE "+key+" = '"+value+"'";
        console.log("Database.selectMultiple: Query:", sqlQuery, "Database:", databaseName);
        connection.query(sqlQuery, function (err, results) {
                if (err) {
                    console.log("Database.selectMultiple: Query:", sqlQuery, "Database:", databaseName, "<ERROR>", erro);
                    return callback(err);
                }
                console.log("Database.selectMultiple: Query:", sqlQuery, "Database:", databaseName, "<DONE>");
                if (!results.length || results.length === 0) {
                    return callback({
                        code: 404,
                        message: 'Not found'
                    });
                }
                callback(undefined, results)
            }
        )
        connection.release();
    });
}

function selectAnd(databaseName, tableName, keys, values, callback) {
    /**
     * Selects the first instance where multiple key-value constraints are satisfied.
     * @param tableName:{String}: The table to fetch the row from.
     * @param keys:{Arary of String}: Names of columns to check the given key-value constraints.
     * @param values:{Array of String}: Each value ordered so they are corresponding to the array of keys.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        var wherestring = "";
        var equalString = "=";
        var valueString = "";
        for (var i = 0; i<keys.length; i++) {
            if(values[i] === 'NULL' || values[i] === 'NOT NULL'){
              equalString = " is ";
              valueString = values[i];
            } else {
              equalString = " = ";
              valueString = "'" + values[i] + "'";
            }
            wherestring += keys[i] + equalString + valueString + " AND ";
        }
        wherestring = wherestring.slice(0,-4);
        var sqlQuery = "SELECT * FROM "+tableName+" WHERE "+wherestring;
        // console.log("QUERY (selectAnd):", sqlQuery);
        connection.query(
            sqlQuery, function (err, results) {
                if (err) {
                    return callback(err);
                }
                if (!results.length || results.length === 0) {
                    return callback({
                        code: 404,
                        message: 'Not found'
                    });
                }
                callback(undefined, results);
            }
        )
        connection.release();
    });
}

//FIXME: Kolla över hur denna används, bcs namnet verkar inte makea sense
function selectColumnAnd(databaseName, tableName, column, keys, values, callback) {
    /**
     * Selects the value of a given column of the first row fulfilling the given key-value constraints.
     * @param tableName:{String}: Name of table to fetch from.
     * @param column:{String}: Name of the column which value should be fetched.
     * @param keys:{Array of String}: Name of columns to check key-value constraints.
     * @param values:{Array of String}: Values with which to check key-value constraints. Same order as keys.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        var wherestring = "";
        var equalString = "=";
        var valueString = "";
        for (var i = 0; i<keys.length; i++) {
          if(values[i] === 'NULL' || values[i] === 'NOT NULL'){
            equalString = " is ";
            valueString = values[i];
          } else {
            equalString = " = ";
            valueString = "'" + values[i] + "'";
          }
          wherestring += keys[i] + equalString + valueString + " AND ";
        }
        wherestring = wherestring.slice(0,-4);
        var sqlQuery = "SELECT "+ column +" FROM "+tableName+" WHERE "+wherestring;

        //console.log("SQL Query (selectColumnAnd):", sqlQuery);

        connection.query(sqlQuery, function (err, results) {
            if (err) {
              return callback(err);
            }
            if (results.length === 0) {
              return callback({
                code: 404,
                message: 'Not found'
              });
            }
            callback(undefined, results);
          }
        )
        connection.release();
    });
}

function update(databaseName, tableName, id, insertString, callback) {
    /**
     * Updates a row with given id with new data.
     * @param tableName:{String}: Name of the table where the update should take place.
     * @param id:{String}: Id of the row to be updated.
     * @param insertString:{String}: The last part of the MYSQL-query with names of columns and their values.
     *                        Example: insertString: "userid = 12, name = 'Simon'"
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        connection.query("UPDATE "+tableName+" SET ? WHERE id = '?'", [insertString, id], callback);
        connection.release();
    });
}


function _delete(databaseName, tableName, id, callback) {
    /**
     * Helper function, deletes a row with given id from a given table.
     * @param tableName:{String}: Name of the table from which the row should be deleted.
     * @param id:{String}: Id of the row which should be deleted from the table.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        connection.query("DELETE FROM "+tableName+" WHERE id = '?'", [id], callback);
        connection.release();
    });
}

function list(databaseName, tableName, callback){
    /**
     * Fetches everything from the given table.
     * @param tableName:{String}: Name of the table to be fetched.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        connection.query("SELECT * FROM "+tableName, callback);
        connection.release();
    });
}

function getLatest(databaseName, tableName, callback){
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        connection.query("SELECT MAX(id) as 'latest' FROM "+tableName, callback);
        connection.release();
    });
}

function addDataTable(databaseName, tableName, columns, callback) {
    /**
     * Adds a new table to the database with the specific columns given.
     * @param tableName:{String}: Name of the table to be created.
     * @param columns:{Array of String}: Names for all the columns.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        var columnstring = "";
        columns.forEach(function(col) {
            columnstring += col + " TEXT, ";
        });
        columnstring = columnstring.slice(0, -2);
        connection.query("CREATE TABLE " + tableName + " (" + columnstring +")", callback);
        connection.release();
    });
}

function getCustomQuery(databaseName, customQuery, callback){
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        connection.query(customQuery, function (err, results) {
            if (err) {
              return callback(err);
            }
            if (results.length === 0) {
              return callback({
                code: 404,
                message: 'Not found'
              });
            }
            callback(undefined, results);
          }
        )
        connection.release();
    });
}

function listColumns(databaseName, tableName, callback) {
    /**
     * Lists names for all columns in a given table.
     * @param tableName:{String}: Name of the table.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        connection.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='"+databaseName+"' AND TABLE_NAME='"+tableName+"'", callback);
        connection.release();
    });
}

function dropTable(databaseName, tableName, callback) {
    /**
     * Drops a given table from the database.
     * @param tableName:{String}: Name of the table.
     */
    mysqlConnector.getConnection(databaseName, function(err, connection){
        if (err) {
            return callback(err);
        }
        connection.query("DROP TABLE "+tableName, callback);
        connection.release(); 
    });
}

module.exports = {
    list: list,
    listColumns: listColumns,
    insert: insert,
    select: select,
    selectAnd: selectAnd,
    selectMultiple: selectMultiple,
    selectColumnAnd: selectColumnAnd,
    update: update,
    delete: _delete,
    addDataTable: addDataTable,
    dropTable: dropTable,
    getLatest: getLatest,
    getCustomQuery: getCustomQuery
};