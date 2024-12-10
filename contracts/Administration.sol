// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { UserStatus } from "./UserStatus.sol";

contract Administration {
    address public administrator;

    event Block(address user, uint256 time);
    event Unblock(address user, uint256 time);
    event GiveBenefactor(address user, uint256 time);
    event DeclineBenefactor(address user, uint256 time);
    event CreateBenefactorRequest(address user, string comment);

    mapping(address => UserStatus) public userStatus;

    enum BenefactorRequestStatus {
        PENDING,
        APPROVED,
        DECLINED
    }

    struct BenefactorRequest {
        string comment;
        string declineReason;
        BenefactorRequestStatus status;
        address sender;
    }
    BenefactorRequest[] public benefactorRequests;
    mapping(address => BenefactorRequest) public isBenefactorRequestSent;
    
    error OnlyAdmin();
    error RequestAlreadySent();

    constructor() {
        administrator = msg.sender;
    }

    modifier onlyAdmin() {
        if (msg.sender != administrator) {
            revert OnlyAdmin();
        }
        _;
    }

    function getBenefactorRequest()
        public
        view
        returns (BenefactorRequest memory)
    {
        return benefactorRequests[benefactorRequests.length - 1];
    }

    function getBenefactorRequestsLength()
        public
        view
        returns (uint256)
    {
        return benefactorRequests.length;
    }

    function createBenefactorRequest(string memory _comment)
        public
    {
        if (isBenefactorRequestSent[msg.sender].sender != address(0)) {
            revert RequestAlreadySent();
        }
        BenefactorRequest memory benefactorRequest = BenefactorRequest(_comment, "", BenefactorRequestStatus.PENDING, msg.sender);
        isBenefactorRequestSent[msg.sender] = benefactorRequest;
        benefactorRequests.push(benefactorRequest);
        emit CreateBenefactorRequest(msg.sender, _comment);
    }

    function blockUser(address user) public onlyAdmin {
        userStatus[user] = UserStatus.Blocked;
        emit Block(user, block.timestamp);
    }

    function unblockUser(address user) public onlyAdmin {
        userStatus[user] = UserStatus.Active;
        emit Unblock(user, block.timestamp);
    }

    function giveBenefactorToLast() public onlyAdmin {
        BenefactorRequest memory request = benefactorRequests[benefactorRequests.length - 1];
        userStatus[request.sender] = UserStatus.Benefactor;
        benefactorRequests.pop();
        isBenefactorRequestSent[request.sender] = BenefactorRequest(request.comment, "", BenefactorRequestStatus.APPROVED, request.sender);
        emit GiveBenefactor(request.sender, block.timestamp);
    }

    function declineBenefactorToLast(string memory _reason) public onlyAdmin {
        BenefactorRequest memory request = benefactorRequests[benefactorRequests.length - 1];
        benefactorRequests.pop();
        isBenefactorRequestSent[request.sender] = BenefactorRequest(request.comment, _reason, BenefactorRequestStatus.DECLINED, request.sender);
        emit DeclineBenefactor(request.sender, block.timestamp);
    }
}
