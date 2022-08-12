import { EventFragment, ParamType } from "@ethersproject/abi";
import { Contract } from "ethers";
import fs from "fs";

import type { PonderConfig } from "./configParser";

/*
We want:
1) Ponder-specific Contract type (or just ethers)?
2) Handler function types for each event in the ABI
*/

const header = `
/* Autogenerated file. Do not edit manually. */
`;

const common = `
${header}
export { BigNumber } from 'ethers';
`;

const importTypeString = `
${header}
import { BigNumber } from "./common";
`;

const codegen = async (config: PonderConfig) => {
  fs.writeFileSync(`generated/common.ts`, common, "utf8");

  for (const source of config.sources) {
    const contract = new Contract(source.address, source.abi);

    const eventHandlers = Object.entries(contract.interface.events).map(
      ([eventSignature, event]) =>
        generateEventHandlerType(eventSignature, event)
    );

    const eventHandlersTypeString = eventHandlers
      .map((handler) => handler.typeString)
      .join("");

    const contractHandlersTypeString = `
    type ${source.name}Handlers = { ${eventHandlers
      .map(({ name }) => `${name}?: ${name}Handler`)
      .join(",")}}
    `;

    const exportTypeString = `
    export type { ${eventHandlers
      .map(({ name }) => `${name}Handler`)
      .join(",")},${source.name}Handlers}
    `;

    const final =
      importTypeString +
      eventHandlersTypeString +
      contractHandlersTypeString +
      exportTypeString;

    fs.writeFileSync(`generated/${source.name}.ts`, final, "utf8");
  }
};

// HELPERS

const generateEventHandlerType = (
  eventSignature: string,
  event: EventFragment
) => {
  const eventName = eventSignature.slice(0, eventSignature.indexOf("("));

  const parameterTypes = event.inputs
    .map((param) => `${param.name}: ${getParamType(param)}; `)
    .join("");

  const eventHandlerTypes = `
  type ${eventName}Params = { ${parameterTypes}}
  type ${eventName}Handler = (params: ${eventName}Params) => void;
  `;

  return {
    name: eventName,
    typeString: eventHandlerTypes,
  };
};

const valueTypeMap: { [baseType: string]: string | undefined } = {
  bool: "boolean",
  address: "string",
  string: "string",
  int: "BigNumber",
  uint: "BigNumber",
  bytes: "Bytes",
};

const getParamType = (param: ParamType) => {
  // Remove any trailing numbers (uint256 -> uint)
  const trimmedParamBaseType = param.baseType.replace(/[0-9]+$/, "");

  const valueType = valueTypeMap[trimmedParamBaseType];
  if (valueType) return valueType;

  console.error("unhandled param:", { param });

  return "unknown";
};

export { codegen };
