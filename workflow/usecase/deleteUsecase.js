const { Client } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

exports.handler = async (event) => {
    const usecase_id = event.queryStringParameters?.usecase_id ?? null;
	if ( usecase_id == null || usecase_id == '') {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: "The 'usecase_id' query parameters are required and must have a non-empty value."
            }),
        };
    }
    const secretsManagerClient = new SecretsManagerClient({ region: 'us-east-1' });
    const configuration = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: 'serverless/lambda/credintials' }));
    const dbConfig = JSON.parse(configuration.SecretString);
    
    const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        database: 'workflow',
        user: dbConfig.engine,
        password: dbConfig.password
    });
    try {
        await client
            .connect()
            .then(() => {
                console.log("Connected to the database");
            })
            .catch((err) => {
                console.log("Error connecting to the database. Error :" + err);
                throw new Error('Error connecting to the database');
            });

        // Check for tasks existence
        const tasksExistQuery = 'SELECT COUNT(*) FROM tasks_table WHERE usecase_id = $1';
        const tasksExistResult = await client.query(tasksExistQuery, [usecase_id]);

        if (tasksExistResult.rows[0].count !== '0') {
            // Tasks found, delete them first
            const deleteTasksQuery = 'DELETE FROM tasks_table WHERE usecase_id = $1';
            await client.query(deleteTasksQuery, [usecase_id]);
        }

        // Check for usecase existence
        const usecaseExistQuery = 'SELECT COUNT(*) FROM usecases_table WHERE id = $1';
        const usecaseExistResult = await client.query(usecaseExistQuery, [usecase_id]);

        if (usecaseExistResult.rows[0].count !== '0') {
            // Usecase found, delete it
            const deleteUsecaseQuery = 'DELETE FROM usecases_table WHERE id = $1';
            await client.query(deleteUsecaseQuery, [usecase_id]);
        } else {
            // Usecase not found
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Usecase not found for the specified ID' }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Usecase deleted successfully' }),
        };
    } catch (error) {
        console.error('Error executing query', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    } finally {
        await client.end();
    }
};