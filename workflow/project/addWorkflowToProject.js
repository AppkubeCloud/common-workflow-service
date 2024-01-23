const { connectToDatabase } = require("../db/dbConnector");
const { SFNClient, CreateStateMachineCommand } = require("@aws-sdk/client-sfn");

exports.handler = async (event) => {
	const client = await connectToDatabase();
	const requestBody = JSON.parse(event.body);
	const { name, created_by_id, project_id, stages } = requestBody;
	const metaData = {
		created_by_id: created_by_id,
		updated_by_id: created_by_id,
		stages: stages,
	};
	const sfnClient = new SFNClient({ region: "us-east-1" });
	const newStateMachine = generateStateMachine2(stages);
	// console.log(JSON.stringify(newStateMachine))
	const input = {
		name: name,
		definition: JSON.stringify(newStateMachine),
		roleArn: "arn:aws:iam::657907747545:role/backendstepfunc-Role",
	};
	try {
		const command = new CreateStateMachineCommand(input);
		const commandResponse = await sfnClient.send(command);
		console.log(JSON.stringify(commandResponse));
		metaData.created_time = commandResponse.creationDate;
		let query = `
					insert into workflows_table
					(name, arn, metadata, project_id) values ($1, $2, $3::jsonb, $4)
					returning *`;

		const result = await client.query(query, [
			name,
			commandResponse.stateMachineArn,
			metaData,
			project_id,
		]);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(result.rows[0]),
		};
	} catch (error) {
		console.error("Error updating data:", error);
		if (error.name == "StateMachineAlreadyExists") {
			return {
				statusCode: 500,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					error: "Workflow with same name already exists",
				}),
			};
		}
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: "Internal Server Error",
				error: error.message,
			}),
		};
	}
};

const generateStateMachine1 = (stages) => {
	const newStepFunction = {
		Comment: "My test workflow state machine",
		StartAt: Object.keys(stages[0])[0],
		States: {},
	};
	for (let i = 0; i < stages.length; i++) {
		const currentStageName = Object.keys(stages[i])[0];
		const nextStageName =
			i < stages.length - 1 ? Object.keys(stages[i + 1])[0] : null;
		const tasks = stages[i][currentStageName].tasks;
		const stageTasksName = `${currentStageName}-tasks`;
		const tasksObjArray = tasks.map((task, index) => {
			return {
				StartAt: currentStageName + "-" + task,
				States: {
					[currentStageName + "-" + task]: {
						Type: "Task",
						Resource:
							"arn:aws:states:::lambda:invoke.waitForTaskToken",
						Parameters: {
							FunctionName: "workflow-parallel-task-lambda",
							Payload: {
								[`executionArn.$`]: "$$.Execution.Id",
								[`token.$`]: "$$.Task.Token",
								[`stateName.$`]: "$$.State.Name",
							},
						},
						End: true,
					},
				},
			};
		});
		const paralleState = {
			Type: "Parallel",
			Branches: tasksObjArray,
		};
		if (nextStageName) {
			paralleState.Next = nextStageName;
		} else {
			paralleState.End = true;
		}
		newStepFunction.States[stageTasksName] = paralleState;

		newStepFunction.States[currentStageName] = {
			Type: "Task",
			Resource:
				"arn:aws:lambda:us-east-1:657907747545:function:workflow-process-lambda:$LATEST",
			ResultPath: `$.${currentStageName}Result`,
			Next: stageTasksName,
		};
	}
	return newStepFunction;
};

const generateStateMachine2 = (stages) => {
	const newStepFunction = {
		Comment: "My test workflow state machine",
		StartAt: "stages",
		States: {
			stages: {
				Type: "Parallel",
				End: true,
				Branches: [],
			},
		},
	};
	for (let i = 0; i < stages.length; i++) {
		const currentStageName = Object.keys(stages[i])[0];
		const nextStageName = currentStageName + "-tasks";
		const stage = {
			StartAt: currentStageName,
			States: {},
		};
		stage.States[currentStageName] = {
			Type: "Task",
			Resource:
				"arn:aws:lambda:us-east-1:657907747545:function:workflow-process-lambda:$LATEST",
			Parameters: {
				[`payload.$`]: "$",
				[`stateName.$`]: "$$.State.Name",
			},
			Retry: [
				{
					ErrorEquals: [
						"Lambda.ServiceException",
						"Lambda.AWSLambdaException",
						"Lambda.SdkClientException",
						"Lambda.TooManyRequestsException",
					],
					IntervalSeconds: 1,
					MaxAttempts: 3,
					BackoffRate: 2,
				},
			],
			Next: nextStageName,
			ResultPath: "$",
		};

		const tasks = stages[i][currentStageName].tasks;
		const stageTasksName = `${currentStageName}-tasks`;
		const tasksObjArray = tasks.map((task, index) => {
			return {
				StartAt: currentStageName + "-" + task,
				States: {
					[currentStageName + "-" + task]: {
						Type: "Task",
						Resource:
							"arn:aws:states:::lambda:invoke.waitForTaskToken",
						Parameters: {
							FunctionName: "workflow-parallel-task-lambda",
							Payload: {
								[`executionArn.$`]: "$$.Execution.Id",
								[`token.$`]: "$$.Task.Token",
								[`taskName.$`]: "$$.State.Name",
								[`payload.$`]: "$",
							},
						},
						End: true,
					},
				},
			};
		});

		stage.States[nextStageName] = {
			Type: "Parallel",
			Branches: tasksObjArray,
			End: true,
		};
		newStepFunction.States.stages.Branches.push(stage);
	}
	return newStepFunction;
};
