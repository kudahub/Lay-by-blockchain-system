// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IERC20Layby {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LaybyEscrow {
    uint64 public constant cancellationResponseWindow = 7 days;

    enum State {
        None,
        Proposed,
        Active,
        Completed,
        Cancelled
    }

    struct Agreement {
        address merchant;
        address customer;
        uint256 totalZarCents;
        uint256 totalTokenAmount;
        uint256 depositTokenAmount;
        uint256 paidTokenAmount;
        uint16 monthlyInstallments;
        uint16 paymentsMade;
        uint16 cancellationRefundBps;
        uint64 fxRateE6;
        uint64 intervalSeconds;
        uint64 nextDueAt;
        uint64 cancelRequestedAt;
        bytes32 externalRef;
        bytes32 termsHash;
        State state;
    }

    IERC20Layby public immutable token;
    uint256 public nextAgreementId = 1;
    mapping(uint256 => Agreement) private agreements;
    uint256 private entered = 1;

    event AgreementCreated(
        uint256 indexed agreementId,
        bytes32 indexed externalRef,
        address indexed merchant,
        address customer,
        uint256 totalZarCents,
        uint256 totalTokenAmount,
        uint256 depositTokenAmount,
        uint16 monthlyInstallments,
        uint64 fxRateE6,
        uint16 cancellationRefundBps,
        bytes32 termsHash
    );
    event AgreementAccepted(uint256 indexed agreementId, address indexed customer);
    event InstalmentPaid(
        uint256 indexed agreementId,
        address indexed customer,
        uint16 sequence,
        uint256 amount,
        uint256 totalPaid
    );
    event CancellationRequested(uint256 indexed agreementId, uint64 responseDeadline);
    event AgreementCancelled(
        uint256 indexed agreementId,
        address indexed customer,
        uint256 refundAmount,
        uint256 merchantAmount
    );
    event AgreementCompleted(uint256 indexed agreementId, address indexed merchant, uint256 amount);

    modifier nonReentrant() {
        require(entered == 1, "Reentrant call");
        entered = 2;
        _;
        entered = 1;
    }

    constructor(address tokenAddress) {
        require(tokenAddress.code.length > 0, "Token must be a contract");
        token = IERC20Layby(tokenAddress);
    }

    function createAgreement(
        bytes32 externalRef,
        bytes32 termsHash,
        address customer,
        uint256 totalZarCents,
        uint64 fxRateE6,
        uint256 totalTokenAmount,
        uint256 depositTokenAmount,
        uint16 monthlyInstallments,
        uint64 intervalSeconds,
        uint16 cancellationRefundBps
    ) external returns (uint256 agreementId) {
        require(customer != address(0) && customer != msg.sender, "Invalid customer");
        require(externalRef != bytes32(0) && termsHash != bytes32(0), "Missing agreement reference");
        require(totalZarCents > 0 && totalTokenAmount > 0, "Invalid total");
        require(depositTokenAmount > 0 && depositTokenAmount < totalTokenAmount, "Invalid deposit");
        require(monthlyInstallments > 0 && monthlyInstallments <= 36, "Invalid term");
        require(intervalSeconds >= 1 days, "Payment interval too short");
        require(cancellationRefundBps <= 10_000, "Invalid refund percentage");

        agreementId = nextAgreementId++;
        agreements[agreementId] = Agreement({
            merchant: msg.sender,
            customer: customer,
            totalZarCents: totalZarCents,
            totalTokenAmount: totalTokenAmount,
            depositTokenAmount: depositTokenAmount,
            paidTokenAmount: 0,
            monthlyInstallments: monthlyInstallments,
            paymentsMade: 0,
            cancellationRefundBps: cancellationRefundBps,
            fxRateE6: fxRateE6,
            intervalSeconds: intervalSeconds,
            nextDueAt: 0,
            cancelRequestedAt: 0,
            externalRef: externalRef,
            termsHash: termsHash,
            state: State.Proposed
        });

        emit AgreementCreated(
            agreementId,
            externalRef,
            msg.sender,
            customer,
            totalZarCents,
            totalTokenAmount,
            depositTokenAmount,
            monthlyInstallments,
            fxRateE6,
            cancellationRefundBps,
            termsHash
        );
    }

    function acceptAgreement(uint256 agreementId) external {
        Agreement storage agreement = _getAgreement(agreementId);
        require(agreement.state == State.Proposed, "Agreement is not offered");
        require(msg.sender == agreement.customer, "Only customer may accept");
        agreement.state = State.Active;
        agreement.nextDueAt = uint64(block.timestamp);
        emit AgreementAccepted(agreementId, msg.sender);
    }

    function nextPaymentAmount(uint256 agreementId) public view returns (uint256) {
        Agreement storage agreement = _getAgreement(agreementId);
        require(agreement.state == State.Active, "Agreement is not active");
        require(agreement.paymentsMade <= agreement.monthlyInstallments, "All payments made");
        if (agreement.paymentsMade == 0) return agreement.depositTokenAmount;
        uint256 paymentsRemaining = uint256(agreement.monthlyInstallments) - (agreement.paymentsMade - 1);
        return (agreement.totalTokenAmount - agreement.paidTokenAmount + paymentsRemaining - 1) / paymentsRemaining;
    }

    function payInstalment(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _getAgreement(agreementId);
        require(agreement.state == State.Active, "Agreement is not active");
        require(msg.sender == agreement.customer, "Only customer may pay");
        require(agreement.cancelRequestedAt == 0, "Cancellation is pending");
        require(block.timestamp >= agreement.nextDueAt, "Instalment not due");

        uint256 amount = nextPaymentAmount(agreementId);
        require(token.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        agreement.paidTokenAmount += amount;
        agreement.paymentsMade += 1;

        if (agreement.paidTokenAmount == agreement.totalTokenAmount) {
            agreement.state = State.Completed;
            require(token.transfer(agreement.merchant, agreement.totalTokenAmount), "Merchant payout failed");
            emit AgreementCompleted(agreementId, agreement.merchant, agreement.totalTokenAmount);
        } else {
            agreement.nextDueAt = uint64(agreement.nextDueAt + agreement.intervalSeconds);
        }
        emit InstalmentPaid(agreementId, msg.sender, agreement.paymentsMade - 1, amount, agreement.paidTokenAmount);
    }

    function requestCancellation(uint256 agreementId) external {
        Agreement storage agreement = _getAgreement(agreementId);
        require(agreement.state == State.Active, "Agreement is not active");
        require(msg.sender == agreement.customer, "Only customer may request");
        require(agreement.cancelRequestedAt == 0, "Cancellation already pending");
        agreement.cancelRequestedAt = uint64(block.timestamp);
        emit CancellationRequested(agreementId, uint64(block.timestamp + cancellationResponseWindow));
    }

    function approveCancellation(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _getAgreement(agreementId);
        require(agreement.state == State.Active, "Agreement is not active");
        require(msg.sender == agreement.merchant, "Only merchant may approve");
        require(agreement.cancelRequestedAt != 0, "No cancellation request");
        require(block.timestamp < uint256(agreement.cancelRequestedAt) + cancellationResponseWindow, "Response window elapsed");

        uint256 refundAmount = agreement.paidTokenAmount * agreement.cancellationRefundBps / 10_000;
        uint256 merchantAmount = agreement.paidTokenAmount - refundAmount;
        agreement.state = State.Cancelled;
        if (refundAmount > 0) require(token.transfer(agreement.customer, refundAmount), "Customer refund failed");
        if (merchantAmount > 0) require(token.transfer(agreement.merchant, merchantAmount), "Merchant settlement failed");
        emit AgreementCancelled(agreementId, agreement.customer, refundAmount, merchantAmount);
    }

    function finalizeCancellation(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = _getAgreement(agreementId);
        require(agreement.state == State.Active, "Agreement is not active");
        require(agreement.cancelRequestedAt != 0, "No cancellation request");
        require(block.timestamp >= uint256(agreement.cancelRequestedAt) + cancellationResponseWindow, "Response window active");
        uint256 refundAmount = agreement.paidTokenAmount;
        agreement.state = State.Cancelled;
        if (refundAmount > 0) require(token.transfer(agreement.customer, refundAmount), "Customer refund failed");
        emit AgreementCancelled(agreementId, agreement.customer, refundAmount, 0);
    }

    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return _getAgreement(agreementId);
    }

    function _getAgreement(uint256 agreementId) private view returns (Agreement storage agreement) {
        agreement = agreements[agreementId];
        require(agreement.state != State.None, "Agreement not found");
    }
}
