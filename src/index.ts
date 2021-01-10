import ts, { factory } from 'typescript';
import path from 'path';
import fs from 'fs';
import { buildType, OBJECT_NAME, MARCO_NAME } from "./transformer";

export default function transformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
	console.log(`[t-ts-transformer INFO] If you will get any problems using this transformer, please
	leave an issue on GitHub https://github.com/alihsaas/t-ts-transformer/issues with your types example`)

	return (context: ts.TransformationContext) => (file: ts.SourceFile) => visitNodeAndChildren(file, program, context);
}

function visitNodeAndChildren(node: ts.SourceFile, program: ts.Program, context: ts.TransformationContext): ts.SourceFile;
function visitNodeAndChildren(node: ts.Node, program: ts.Program, context: ts.TransformationContext): ts.Node | undefined;
function visitNodeAndChildren(node: ts.Node, program: ts.Program, context: ts.TransformationContext): ts.Node | undefined {
	return ts.visitEachChild(visitNode(node, program), childNode => visitNodeAndChildren(childNode, program, context), context);
}

function visitNode(node: ts.SourceFile, program: ts.Program): ts.SourceFile;
function visitNode(node: ts.Node, program: ts.Program): ts.Node | undefined;
function visitNode(node: ts.Node, program: ts.Program): ts.Node | undefined {
	if (isModuleImportExpression(node, program)) {
		return factory.createImportDeclaration(undefined, undefined,
			factory.createImportClause(
				false,
				undefined,
				factory.createNamedImports([
					factory.createImportSpecifier(undefined, factory.createIdentifier(OBJECT_NAME))
				]),
			),
			factory.createStringLiteral("@rbxts/t"));
	}

	if (ts.isCallExpression(node)) {
		return visitCallExpression(node, program);
	}

	return node;
}

function handleTerrifyCallExpression(
	node: ts.CallExpression,
	functionName: string,
	typeChecker: ts.TypeChecker,
) {
	switch (functionName) {
		case MARCO_NAME: {

			const typeArguments = node.typeArguments

			if (typeArguments === undefined || typeArguments.length === 0)
				throw new Error(`Please pass a type argument to the $terrify function`)

			const type = typeChecker.getTypeFromTypeNode(typeArguments[0]);

			return buildType(type, typeChecker);
		}
		default:
			throw `function ${functionName} cannot be handled by this version of rbxts-interface-to-t`;
	}
}

function visitCallExpression(node: ts.CallExpression, program: ts.Program) {
	const typeChecker = program.getTypeChecker();
	const signature = typeChecker.getResolvedSignature(node);
	if (!signature) {
		return node;
	}
	const { declaration } = signature;
	if (!declaration || ts.isJSDocSignature(declaration) || !isModule(declaration.getSourceFile())) {
		return node;
	}

	const functionName = declaration.name && declaration.name.getText();
	if (!functionName) {
		return node;
	}

	return handleTerrifyCallExpression(node, functionName, typeChecker);
}

const sourceText = fs.readFileSync(path.join(__dirname, "..", "index.d.ts"), "utf8");
function isModule(sourceFile: ts.SourceFile) {
	return sourceFile.text === sourceText;
}

function isModuleImportExpression(node: ts.Node, program: ts.Program) {
	if (!ts.isImportDeclaration(node)) {
		return false;
	}

	if (!node.importClause) {
		return false;
	}

	const namedBindings = node.importClause.namedBindings;
	if (!node.importClause.name && !namedBindings) {
		return false;
	}

	const importSymbol = program.getTypeChecker().getSymbolAtLocation(node.moduleSpecifier);

	if (!importSymbol || !isModule(importSymbol.valueDeclaration.getSourceFile())) {
		return false;
	}

	return true;
}
