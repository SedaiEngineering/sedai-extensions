import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as applicationautoscaling from "aws-cdk-lib/aws-applicationautoscaling";
import * as path from "path";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // SedaiavlambdaLogGroup
    const SedaiavlambdaLogGroup = new logs.LogGroup(
      this,
      "SedaiavlambdaLogGroup",
      {
        logGroupName:
          "/aws/lambda/sedai-avlambda-control-center-production-function",
      }
    );
    (
      SedaiavlambdaLogGroup.node.defaultChild as logs.CfnLogGroup
    ).overrideLogicalId("SedaiavlambdaLogGroup");

    // IamRoleLambdaExecution
    const IamRoleLambdaExecution = new iam.Role(
      this,
      "IamRoleLambdaExecution",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        description: "An example IAM role in AWS CDK",
        inlinePolicies: {
          //        DescribeACMCerts: describeAcmCertificates,
        },
        path: "/",
        roleName: cdk.Fn.join("-", [
          "sedai-avlambda-control-center",
          "production",
          this.region,
          "lambdaRole",
        ]),
      }
    );
    (IamRoleLambdaExecution.node.defaultChild as iam.CfnRole).overrideLogicalId(
      "IamRoleLambdaExecution"
    );

    const IamPolicyLambdaExecution = new iam.Policy(
      this,
      "IamPolicyLambdaExecution",
      {
        policyName: cdk.Fn.join("-", [
          "sedai-avlambda-control-center",
          "production",
          "lambda",
        ]),
        statements: [
          new iam.PolicyStatement({
            actions: ["logs:CreateLogStream", "logs:CreateLogGroup"],
            resources: [
              cdk.Fn.sub(
                "arn:${Partition}:logs:${Region}:${AccountId}:log-group:/aws/lambda/sedai-avlambda-control-center-production*:*",
                {
                  "Partition": cdk.Stack.of(this).partition,
                  "Region": cdk.Stack.of(this).region,
                  "AccountId": cdk.Stack.of(this).account,
                }
              ),
            ],
          }),
          new iam.PolicyStatement({
            actions: ["logs:PutLogEvents"],
            resources: [
              cdk.Fn.sub(
                "arn:${Partition}:logs:${Region}:${AccountId}:log-group:/aws/lambda/sedai-avlambda-control-center-production*:*:*",
                {
                  "Partition": cdk.Stack.of(this).partition,
                  "Region": cdk.Stack.of(this).region,
                  "AccountId": cdk.Stack.of(this).account,
                }
              ),
            ],
          }),
          new iam.PolicyStatement({
            actions: [
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem",
            ],
            resources: [
              "arn:aws:dynamodb:us-east-1:*:table/SedaiResourceConcurrencyStats",
            ],
          }),
          new iam.PolicyStatement({
            actions: ["lambda:InvokeFunction", "lambda:InvokeAsync"],
            resources: ["*"],
          }),
        ],
      }
    );
    (
      IamPolicyLambdaExecution.node.defaultChild as iam.CfnPolicy
    ).overrideLogicalId("IamPolicyLambdaExecution");
    IamRoleLambdaExecution.attachInlinePolicy(IamPolicyLambdaExecution);

    // SedaiavlambdaLambdaFunction
    const SedaiavlambdaLambdaFunction = new lambda.Function(
      this,
      "sedai-avlambda-control-center-production-function",
      {
        runtime: lambda.Runtime.GO_1_X,
        memorySize: 256,
        timeout: cdk.Duration.seconds(6),
        handler: "AVLambdaGo",
        code: lambda.Code.fromAsset(path.join(__dirname, "/avlambda.zip")),
        environment: {
          DYNAMODB_TABLE: "SedaiResourceConcurrencyStats",
        },
        role: IamRoleLambdaExecution,
      }
    );
    SedaiavlambdaLambdaFunction.node.addDependency(SedaiavlambdaLogGroup);
    (
      SedaiavlambdaLambdaFunction.node.defaultChild as lambda.CfnFunction
    ).overrideLogicalId("SedaiavlambdaLambdaFunction");

    // SedaiavlambdaLambdaVersion
    const SedaiavlambdaLambdaVersion = new lambda.Version(
      this,
      "SedaiavlambdaLambdaVersion",
      {
        lambda: SedaiavlambdaLambdaFunction,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      }
    );
    (
      SedaiavlambdaLambdaVersion.node.defaultChild as lambda.CfnVersion
    ).overrideLogicalId("SedaiavlambdaLambdaVersion");

    // SedaiavlambdaLambdaFunctionUrl
    const SedaiavlambdaLambdaFunctionUrl = new lambda.FunctionUrl(
      this,
      "SedaiavlambdaLambdaFunctionUrl",
      {
        function: SedaiavlambdaLambdaFunction,
        authType: lambda.FunctionUrlAuthType.NONE,
      }
    );
    (
      SedaiavlambdaLambdaFunctionUrl.node.defaultChild as lambda.CfnUrl
    ).overrideLogicalId("SedaiavlambdaLambdaFunctionUrl");

    // SedaiavlambdaLambdaPermissionFnUrl
    SedaiavlambdaLambdaFunction.addPermission("SedaiavlambdaLambdaPermissionFnUrl",{
      principal: new iam.AnyPrincipal(),
      action: "lambda:InvokeFunctionUrl",
      functionUrlAuthType: lambda.FunctionUrlAuthType.NONE,
      scope: SedaiavlambdaLambdaFunction
    });

    // SedaiResourceConcurrencyStatsTable
    const SedaiResourceConcurrencyStatsTable = new dynamodb.Table(
      this,
      "SedaiResourceConcurrencyStatsTable",
      {
        tableName: "SedaiResourceConcurrencyStatsTable",
        partitionKey: {
          name: "resourceId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PROVISIONED,
        readCapacity: 1,
        writeCapacity: 1,
      }
    );
    (
      SedaiResourceConcurrencyStatsTable.node.defaultChild as dynamodb.CfnTable
    ).overrideLogicalId("SedaiResourceConcurrencyStatsTable");

    // sedaiavlambdacontrolcenterDynamo
    const sedaiavlambdacontrolcenterDynamo = new iam.Role(
      this,
      "sedaiavlambdacontrolcenterDynamo",
      {
        assumedBy: new iam.ServicePrincipal(
          "application-autoscaling.amazonaws.com"
        ),
        description: "An example IAM role in AWS CDK",
        inlinePolicies: {
          //        DescribeACMCerts: describeAcmCertificates,
        },
        roleName: "sedaiavlambdacontrolcenterDynamo",
      }
    );
    (
      sedaiavlambdacontrolcenterDynamo.node.defaultChild as iam.CfnRole
    ).overrideLogicalId("sedaiavlambdacontrolcenterDynamo");

    const sedaiavlambdacontrolcenterDynamoPolicy = new iam.Policy(
      this,
      "sedaiavlambdacontrolcenterDynamoPolicy",
      {
        policyName:
          "sedaiavlambdacontrolcenterDynamo3487d7010c5f4acfa479b9eac5ce2e8a",
        statements: [
          new iam.PolicyStatement({
            actions: [
              "cloudwatch:PutMetricAlarm",
              "cloudwatch:DescribeAlarms",
              "cloudwatch:DeleteAlarms",
              "cloudwatch:GetMetricStatistics",
              "cloudwatch:SetAlarmState",
            ],
            resources: ["*"],
          }),
          new iam.PolicyStatement({
            actions: ["dynamodb:DescribeTable", "dynamodb:UpdateTable"],
            resources: [
              cdk.Fn.join("", [
                "arn:aws:dynamodb:*:",
                this.account,
                ":table/",
                "SedaiResourceConcurrencyStatsTable",
              ]),
            ],
          }),
        ],
      }
    );
    (
      sedaiavlambdacontrolcenterDynamoPolicy.node.defaultChild as iam.CfnPolicy
    ).overrideLogicalId("sedaiavlambdacontrolcenterDynamoPolicy");
    sedaiavlambdacontrolcenterDynamo.attachInlinePolicy(
      sedaiavlambdacontrolcenterDynamoPolicy
    );
    sedaiavlambdacontrolcenterDynamo.node.addDependency(
      SedaiResourceConcurrencyStatsTable
    );

    // -----------

    // sedaiavlambdacontrolcenterAutoScale
    const sedaiavlambdacontrolcenterAutoScale =
      new applicationautoscaling.ScalableTarget(
        this,
        "sedaiavlambdacontrolcenterAutoScale",
        {
          maxCapacity: 20,
          minCapacity: 1,
          resourceId: cdk.Fn.join("", [
            "table/",
            "SedaiResourceConcurrencyStatsTable",
          ]),
          scalableDimension: "dynamodb:table:ReadCapacityUnits",
          serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
          role: sedaiavlambdacontrolcenterDynamo,
        }
      );
    (
      sedaiavlambdacontrolcenterAutoScale.node
        .defaultChild as applicationautoscaling.CfnScalableTarget
    ).overrideLogicalId("sedaiavlambdacontrolcenterAutoScale");
    sedaiavlambdacontrolcenterAutoScale.node.addDependency(
      SedaiResourceConcurrencyStatsTable
    );
    sedaiavlambdacontrolcenterAutoScale.node.addDependency(
      sedaiavlambdacontrolcenterDynamo
    );

    // sedaiavlambdacontrolCenterTable
    const sedaiavlambdacontrolCenterTable =
      new applicationautoscaling.TargetTrackingScalingPolicy(
        this,
        "sedaiavlambdacontrolCenterTable",
        {
          policyName: "sedaiavlambdacontrolCenterTable",
          predefinedMetric:
            applicationautoscaling.PredefinedMetric
              .DYNAMODB_READ_CAPACITY_UTILIZATION,
          scaleInCooldown: cdk.Duration.seconds(60),
          scaleOutCooldown: cdk.Duration.seconds(60),
          targetValue: 75,
          scalingTarget: sedaiavlambdacontrolcenterAutoScale,
        }
      );
    (
      sedaiavlambdacontrolCenterTable.node
        .defaultChild as applicationautoscaling.CfnScalingPolicy
    ).overrideLogicalId("sedaiavlambdacontrolCenterTable");
    sedaiavlambdacontrolCenterTable.node.addDependency(
      SedaiResourceConcurrencyStatsTable
    );
    sedaiavlambdacontrolCenterTable.node.addDependency(
      sedaiavlambdacontrolcenterAutoScale
    );

    // -----------

    // sedaiavlambdacontrolcenterAutoscale
    const sedaiavlambdacontrolcenterAutoscale =
      new applicationautoscaling.ScalableTarget(
        this,
        "sedaiavlambdacontrolcenterAutoscale",
        {
          maxCapacity: 25,
          minCapacity: 1,
          resourceId: cdk.Fn.join("", [
            "table/",
            "SedaiResourceConcurrencyStatsTable",
          ]),
          scalableDimension: "dynamodb:table:WriteCapacityUnits",
          serviceNamespace: applicationautoscaling.ServiceNamespace.DYNAMODB,
          role: sedaiavlambdacontrolcenterDynamo,
        }
      );
    (
      sedaiavlambdacontrolcenterAutoscale.node
        .defaultChild as applicationautoscaling.CfnScalableTarget
    ).overrideLogicalId("sedaiavlambdacontrolcenterAutoscale");
    sedaiavlambdacontrolcenterAutoscale.node.addDependency(
      SedaiResourceConcurrencyStatsTable
    );
    sedaiavlambdacontrolcenterAutoscale.node.addDependency(
      sedaiavlambdacontrolcenterDynamo
    );

    // sedaiavlambdacontrolcenterTable
    const sedaiavlambdacontrolcenterTable =
      new applicationautoscaling.TargetTrackingScalingPolicy(
        this,
        "sedaiavlambdacontrolcenterTable",
        {
          policyName: "sedaiavlambdacontrolcenterTable",
          predefinedMetric:
            applicationautoscaling.PredefinedMetric
              .DYNAMODB_WRITE_CAPACITY_UTILIZATION,
          scaleInCooldown: cdk.Duration.seconds(60),
          scaleOutCooldown: cdk.Duration.seconds(60),
          targetValue: 50,
          scalingTarget: sedaiavlambdacontrolcenterAutoscale,
        }
      );
    (
      sedaiavlambdacontrolcenterTable.node
        .defaultChild as applicationautoscaling.CfnScalingPolicy
    ).overrideLogicalId("sedaiavlambdacontrolcenterTable");
    sedaiavlambdacontrolcenterTable.node.addDependency(
      SedaiResourceConcurrencyStatsTable
    );
    sedaiavlambdacontrolcenterTable.node.addDependency(
      sedaiavlambdacontrolcenterAutoscale
    );

    // Outputs
    new cdk.CfnOutput(this, "SedaiavlambdaLambdaFunctionQualifiedArn", {
      value: "SedaiavlambdaLambdaVersion",
      description: "Current Lambda function version",
      exportName: "sedai-avlambda-control-center-production-SedaiavlambdaLambdaFunctionQualifiedArn",
    });

    new cdk.CfnOutput(this, "SedaiavlambdaLambdaFunctionUrlValue", {
      value: SedaiavlambdaLambdaFunctionUrl.url,
      description: "Lambda Function URL",
      exportName: "sedai-avlambda-control-center-production-SedaiavlambdaLambdaFunctionUrl",
    });
  }
}
