import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "src");
const supportedExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const issues = [];

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(target);
      }

      if (entry.isFile() && supportedExtensions.has(path.extname(entry.name))) {
        return [target];
      }

      return [];
    }),
  );

  return files.flat();
}

function getScriptKind(filePath) {
  const extension = path.extname(filePath);
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".ts") return ts.ScriptKind.TS;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function getAttributeValue(attribute) {
  if (!attribute || !attribute.initializer) return null;

  if (ts.isStringLiteralLike(attribute.initializer)) {
    return attribute.initializer.text;
  }

  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    ts.isStringLiteralLike(attribute.initializer.expression)
  ) {
    return attribute.initializer.expression.text;
  }

  return null;
}

function getAttributeSource(attribute, sourceFile) {
  if (!attribute || !attribute.initializer) return "";
  return attribute.initializer.getText(sourceFile);
}

function findAttribute(attributes, name) {
  return attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name,
  );
}

function hasSpreadAttribute(attributes) {
  return attributes.properties.some((property) => ts.isJsxSpreadAttribute(property));
}

function hasKeyboardHandler(attributes) {
  return ["onKeyDown", "onKeyUp", "onKeyPress"].some((name) =>
    Boolean(findAttribute(attributes, name)),
  );
}

function isInsideHtmlForm(ancestors, sourceFile) {
  return ancestors.some((ancestor) => {
    return (
      ts.isJsxElement(ancestor) &&
      ancestor.openingElement.tagName.getText(sourceFile) === "form"
    );
  });
}

function pushIssue(sourceFile, node, message) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );

  issues.push({
    file: path.relative(rootDir, sourceFile.fileName),
    line: line + 1,
    column: character + 1,
    message,
  });
}

function visit(node, sourceFile, ancestors = []) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    const tagName = node.tagName.getText(sourceFile);
    const isPlainDomTag = /^[a-z]+$/.test(tagName);
    const attributes = node.attributes;
    const classAttribute =
      findAttribute(attributes, "className") ?? findAttribute(attributes, "class");
    const classSource = getAttributeSource(classAttribute, sourceFile);
    const roleAttribute = findAttribute(attributes, "role");
    const roleValue = getAttributeValue(roleAttribute);
    const tabIndexAttribute = findAttribute(attributes, "tabIndex");
    const onClickAttribute = findAttribute(attributes, "onClick");
    const onDoubleClickAttribute = findAttribute(attributes, "onDoubleClick");
    const onMouseDownAttribute = findAttribute(attributes, "onMouseDown");
    const clickHandlerSource = getAttributeSource(onClickAttribute, sourceFile);

    if (tagName === "a" || tagName === "Link" || tagName === "NavLink") {
      for (const attributeName of ["href", "to"]) {
        const attribute = findAttribute(attributes, attributeName);
        if (getAttributeValue(attribute) === "#") {
          pushIssue(
            sourceFile,
            node,
            `Placeholder ${attributeName}=\"#\" creates a dead click target.`,
          );
        }
      }
    }

    if (tagName === "button" && !hasSpreadAttribute(attributes)) {
      const formActionAttribute = findAttribute(attributes, "formAction");
      const typeValue = getAttributeValue(findAttribute(attributes, "type"));
      const insideHtmlForm = isInsideHtmlForm(ancestors, sourceFile);
      const isSubmitLikeType = typeValue === "submit" || typeValue === "reset";

      const lacksAction = !onClickAttribute && !formActionAttribute;
      const isDeadButton =
        lacksAction &&
        !isSubmitLikeType &&
        (!insideHtmlForm || typeValue === "button");

      if (isDeadButton) {
        pushIssue(
          sourceFile,
          node,
          "Button has no click handler or submit behavior and will render as a dead control.",
        );
      }
    }

    if (isPlainDomTag) {
      const isNaturallyInteractive = [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "label",
        "summary",
      ].includes(tagName);
      const hasClickBehavior =
        Boolean(onClickAttribute) ||
        Boolean(onDoubleClickAttribute) ||
        Boolean(onMouseDownAttribute);
      const stopPropagationOnly =
        Boolean(onClickAttribute) &&
        /stopPropagation\s*\(/.test(clickHandlerSource) &&
        !/navigate\s*\(|set[A-Z]\w*\s*\(|reload\s*\(/.test(clickHandlerSource);

      if (!isNaturallyInteractive && hasClickBehavior && !stopPropagationOnly) {
        if (!roleValue) {
          pushIssue(
            sourceFile,
            node,
            "Clickable non-interactive element is missing a semantic role.",
          );
        }

        if (!tabIndexAttribute) {
          pushIssue(
            sourceFile,
            node,
            "Clickable non-interactive element is missing tabIndex and cannot be keyboard focused.",
          );
        }

        if (!hasKeyboardHandler(attributes)) {
          pushIssue(
            sourceFile,
            node,
            "Clickable non-interactive element is missing keyboard handling.",
          );
        }
      }
    }

    if (classSource.includes("cursor-pointer")) {
      const isNaturallyInteractive = [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "label",
        "summary",
        "Link",
        "NavLink",
      ].includes(tagName);
      const hasClickBehavior =
        Boolean(onClickAttribute) ||
        Boolean(onDoubleClickAttribute) ||
        Boolean(onMouseDownAttribute);

      if (!isNaturallyInteractive && !hasClickBehavior) {
        pushIssue(
          sourceFile,
          node,
          "Element uses cursor-pointer styling but has no click behavior and will feel like a dead control.",
        );
      }
    }
  }

  ts.forEachChild(node, (child) => visit(child, sourceFile, [...ancestors, node]));
}

async function main() {
  const files = await collectFiles(sourceDir);

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(filePath),
    );

    visit(sourceFile, sourceFile);
  }

  if (issues.length > 0) {
    console.error("Dead click target audit failed:\n");
    for (const issue of issues) {
      console.error(
        `${issue.file}:${issue.line}:${issue.column} - ${issue.message}`,
      );
    }
    process.exit(1);
  }

  console.log(`Dead click target audit passed across ${files.length} source files.`);
}

await main();
