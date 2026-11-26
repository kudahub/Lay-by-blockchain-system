export const escrowAbi = [
  "function token() view returns (address)",
  "function createAgreement(bytes32 externalRef, bytes32 termsHash, address customer, uint256 totalZarCents, uint64 fxRateE6, uint256 totalTokenAmount, uint256 depositTokenAmount, uint16 monthlyInstallments, uint64 intervalSeconds, uint16 cancellationRefundBps) returns (uint256)",
  "function acceptAgreement(uint256 agreementId)",
  "function payInstalment(uint256 agreementId)",
  "function nextPaymentAmount(uint256 agreementId) view returns (uint256)",
  "function requestCancellation(uint256 agreementId)",
  "function approveCancellation(uint256 agreementId)",
  "function finalizeCancellation(uint256 agreementId)",
  "function getAgreement(uint256 agreementId) view returns (tuple(address merchant,address customer,uint256 totalZarCents,uint256 totalTokenAmount,uint256 depositTokenAmount,uint256 paidTokenAmount,uint16 monthlyInstallments,uint16 paymentsMade,uint16 cancellationRefundBps,uint64 fxRateE6,uint64 intervalSeconds,uint64 nextDueAt,uint64 cancelRequestedAt,bytes32 externalRef,bytes32 termsHash,uint8 state))",
  "event AgreementCreated(uint256 indexed agreementId, bytes32 indexed externalRef, address indexed merchant, address customer, uint256 totalZarCents, uint256 totalTokenAmount, uint256 depositTokenAmount, uint16 monthlyInstallments, uint64 fxRateE6, uint16 cancellationRefundBps, bytes32 termsHash)",
  "event AgreementAccepted(uint256 indexed agreementId, address indexed customer)",
  "event InstalmentPaid(uint256 indexed agreementId, address indexed customer, uint16 sequence, uint256 amount, uint256 totalPaid)",
  "event CancellationRequested(uint256 indexed agreementId, uint64 responseDeadline)",
  "event AgreementCancelled(uint256 indexed agreementId, address indexed customer, uint256 refundAmount, uint256 merchantAmount)",
];

export const testUsdcAbi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function faucet()",
  "function symbol() view returns (string)",
  "event TestUSDCFaucet(address indexed account, uint256 amount)",
];
