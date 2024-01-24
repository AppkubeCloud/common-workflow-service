const { Client } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
exports.handler = async (event) => {
    
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
    const body = JSON.parse(event.body);
    const { resource_name, email, role, project, description } = body;

    try {
        await client.connect();
        const resource = {
                name: resource_name,
                email:email,
                role:role,
                image: '', 
                project:project,
                description:description,
                current_task: {
                    task_id: '',
                    task_name: '' 
                }
        };

        await client.query(`
            INSERT INTO resources_table (resource)
            VALUES ($1)
        `, [ JSON.stringify(resource)]);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ message: "Successfully resource details inserted " })
        };
    } catch (error) {
        console.error("Error: ", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ message: 'Internal server error' })
        };
    } finally {
        await client.end();
    }
};