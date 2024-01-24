const { connectToDatabase } = require("../db/dbConnector");
const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const { v4: uuid } = require('uuid');
exports.handler = async (event) => {
	const client = await connectToDatabase();
	const requestBody = JSON.parse(event.body);
	const {
		project_id,
		created_by_id,
		usecase_name,
		assigned_to_id,
		description,
		workflow_id,
		start_date,
		end_date,
	} = requestBody;
    const usecase_id = uuid()
	//Check for unqiness of usecase name here if required-- TO DO --
	const stepFunctionClient = new SFNClient({ region: "us-east-1" });
    const stepFunctionPayload  = {
        usecase_id : usecase_id,
        project_id: project_id
    }
	const input = {
		stateMachineArn: "",
		name: usecase_name,
		input: JSON.stringify({
			flag: "new",
            usecase_id : usecase_id,
            project_id: project_id
        }),
	};
	try {
		let getArnQuery = `select 
                                arn, 
                                metadata->'stages' as stages
                            from 
                                workflows_table 
                            where id = $1`;
		const arnResult = await client.query(getArnQuery, [workflow_id]);
		input.stateMachineArn = arnResult.rows[0].arn;
		const stages = arnResult.rows[0].stages;
		const command = new StartExecutionCommand(input);
		const response = await stepFunctionClient.send(command);
		if (response.$metadata.httpStatusCode == 200) {
			const executionArn = response.executionArn;
			const creationDate = response.startDate;
			const usecase = {
				name: usecase_name,
				creation_date: creationDate,
				created_by_id: created_by_id,
				assigned_to_id: assigned_to_id,
				description: description,
				usecase_assignee_id: "",
				start_date: start_date,
				end_date: end_date,
				current_stage: "",
				status: "inprogress",
				stages: generateStages(stages),
			};
			const usecaseInsertQuery = `
                        insert into usecases_table 
                        (id, project_id, workflow_id, arn, usecase)
                        values ($1, $2, $3, $4, $5::jsonb)
                        RETURNING *;
                        `;
			const result = await client.query(usecaseInsertQuery, [
                usecase_id,
				project_id,
				workflow_id,
				executionArn,
				usecase,
			]);
			return {
				statusCode: 201,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify(result.rows),
			};
		} else {
			return {
				statusCode: 500,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					message: "internal server error",
				}),
			};
		}
	} catch (error) {
        console.log(error)
		return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message: "internal server error",
            }),
        };
	} finally {
		await client.end();
	}
};

const generateStages = (stages) => {
	return stages.map((stage) => {
		const stageName = Object.keys(stage)[0];
		const checklist = stage[stageName].checklist;
		return {
			[stageName]: {
				assignee_id: "",
				assigned_by_id: "",
				updated_by_id: "",
				description: "",
				checklist: checklist.map((item, index) => ({
					item_id: index + 1,
					description: item,
					checked: false,
				})),
			},
		};
	});
};
