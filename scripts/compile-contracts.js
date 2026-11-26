import solc from "solc";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sources = {};
for (const name of ["LaybyEscrow.sol", "TestUSDC.sol"]) {
  sources[name] = { content: await readFile(path.join(root, "contracts", name), "utf8") };
}
const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 300 },
    viaIR: true,
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const result = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (result.errors || []).filter((entry) => entry.severity === "error");
for (const entry of result.errors || []) {
  if (entry.severity === "warning") console.warn(entry.formattedMessage);
}
if (errors.length) {
  for (const entry of errors) console.error(entry.formattedMessage);
  process.exitCode = 1;
} else {
  const output = path.join(root, "artifacts", "contracts");
  await mkdir(output, { recursive: true });
  for (const [source, contracts] of Object.entries(result.contracts)) {
    for (const [name, contract] of Object.entries(contracts)) {
      await writeFile(path.join(output, `${name}.json`), JSON.stringify({
        contractName: name,
        sourceName: source,
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
      }, null, 2));
    }
  }
  console.log("Contracts compiled to artifacts/contracts.");
}
