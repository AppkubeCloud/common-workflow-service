const { connectToDatabase } = require("../db/dbConnector");
const AWS = require('aws-sdk');

exports.handler = async (event) => {
    const id = event.queryStringParameters ? event.queryStringParameters.id : null;
	if ( id == null || id == '') {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: "The 'id' query parameters are required and must have a non-empty value."
                }),
        };
    }
    const client = await connectToDatabase();

    try {

        // Delete associated records from tasks_table
        const deleteTasksQuery = `
            DELETE FROM tasks_table
            WHERE usecase_id = $1
        `;

        await client.query(deleteTasksQuery, [id]);

        // Now, delete the usecase from usecases_table
        const deleteUsecaseQuery = `
            DELETE FROM usecases_table
            WHERE id = $1
        `;

        await client.query(deleteUsecaseQuery, [id]);
        
        // Delete Step Functions state machine
        const stateMachineArn = 'arn:aws:states:us-east-1:657907747545:stateMachine:Amar-State-Machine';
        const stepfunctions = new AWS.StepFunctions();

        await stepfunctions.deleteStateMachine({ stateMachineArn }).promise();


        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
              },
            body: JSON.stringify({ message: 'Usecase deleted successfully' }),
        };
    } catch (error) {
        console.error('Error executing query', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
              },
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    } finally {
        await client.end();
    }
};