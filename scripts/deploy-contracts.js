import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

if (process.env.CHAIN_ID !== "43113") throw new Error("Deployment is restricted to Avalanche Fuji (CHAIN_ID=43113).");
if (!process.env.CHAIN_RPC_URL || !process.env.FUJI_DEPLOYER_KEY) {
  throw new Error("Set CHAIN_RPC_URL and FUJI_DEPLOYER_KEY locally; never commit or share the key.");
}

const provider = new JsonRpcProvider(process.env.CHAIN_RPC_URL, 43113);
const network = await provider.getNetwork();
if (Number(network.chainId) !== 43113) throw new Error("RPC endpoint is not Avalanche Fuji.");
const signer = new Wallet(process.env.FUJI_DEPLOYER_KEY, provider);
const readArtifact = async (name) => JSON.parse(await readFile(path.join(process.cwd(), "artifacts", "contracts", `${name}.json`), "utf8"));
const testTokenArtifact = await readArtifact("TestUSDC");
const escrowArtifact = await readArtifact("LaybyEscrow");

const testToken = await new ContractFactory(testTokenArtifact.abi, testTokenArtifact.bytecode, signer).deploy();
await testToken.waitForDeployment();
const escrow = await new ContractFactory(escrowArtifact.abi, escrowArtifact.bytecode, signer)
  .deploy(await testToken.getAddress());
await escrow.waitForDeployment();

console.log(`TestUSDC (tUSDC): ${await testToken.getAddress()}`);
console.log(`LaybyEscrow: ${await escrow.getAddress()}`);
console.log("Copy these addresses into the local .env file. No deployment occurs during app startup.");
