const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
    const getWorkflows = `  SELECT
                                id,
                                name,
                                metadata->'stages' AS stages
                            FROM
                                workflows_table`;
    const client = await connectToDatabase();
    try {
        const getWorkflowsResult = await client.query(getWorkflows);
        console.log(getWorkflowsResult);
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(getWorkflowsResult.rows),
        };
    } catch (error) {
        console.error("Error executing query", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: "Internal Server Error" }),
        };
    } finally {
        await client.end();
    }
};
