// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Administration } from "./Administration.sol";
import { UserStatus }  from "./UserStatus.sol";
import { FundraiserStatus }  from "./FundraiserStatus.sol";

contract Fundraiser {
    Administration public administrationContract;

    struct Donation {
        uint256 amount;
        string comment;
        address sender;
    }
    Donation[] public donations;

    struct Comment {
        string comment;
        address sender;
    }
    Comment[] public comments;

    FundraiserStatus public status;
    string public declineReason;
    address payable public beneficiary;
    uint256 public goal;
    uint256 public deadline;
    uint256 public createdAt;
    uint256 public totalDonations;
    string public title;
    string public description;
    string public uri;
    mapping(address => bool) public upvote;
    uint256 public upvoteCount;

    event DonationReceived(address indexed donor, uint256 amount, string comment);
    event CommentCreated(address indexed creator, string comment);
    event FundsWithdrawn(uint256 amount, uint256 time);
    event UpvoteToggled(address indexed user, bool value);

    error ReasonTooShort();
    error ReasonTooLong();
    error GoalNotMet();
    error DonationTooLow();
    error NotAdmin();
    error UserBlocked();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NotBeneficiary();

    constructor(
        FundraiserStatus _status,
        address _administrationAddress,
        address payable _beneficiary,
        uint256 _goal,
        uint256 _durationInDays,
        string memory _title,
        string memory _description,
        string memory _uri
    ) {
        status = _status;
        administrationContract = Administration(_administrationAddress);
        beneficiary = _beneficiary;
        goal = _goal;
        deadline = block.timestamp + (_durationInDays * 1 days);
        createdAt = block.timestamp;
        title = _title;
        description = _description;
        uri = _uri;
    }

    modifier onlyAdmin() {
        if (msg.sender != administrationContract.administrator()) {
            revert NotAdmin();
        }
        _;
    }

    modifier notBlocked() {
        if (administrationContract.userStatus(msg.sender) == UserStatus.Blocked) {
            revert UserBlocked();
        }
        _;
    }

    modifier onlyBeforeDeadline() {
        if (block.timestamp > deadline) {
            revert DeadlinePassed();
        }
        _;
    }

    modifier onlyBeneficiary() {
        if (msg.sender != beneficiary) {
            revert NotBeneficiary();
        }
        _;
    }

    function toggleUpvote() public {
        if (upvote[msg.sender] == false) {
            upvote[msg.sender] = true;
            upvoteCount++;
            emit UpvoteToggled(msg.sender, true);
        } else {
            upvote[msg.sender] = false;
            upvoteCount--;
            emit UpvoteToggled(msg.sender, false);
        }

    }

    function approve() public onlyAdmin {
        status = FundraiserStatus.APPROVED;
        declineReason = "";
    }

    function decline(string memory _reason) public onlyAdmin {
        uint256 reasonLength = bytes(_reason).length;

        if (reasonLength < 1) {
            revert ReasonTooShort();
        }
        
        if (reasonLength > 200) {
            revert ReasonTooLong();
        }

        status = FundraiserStatus.DECLINED;
        declineReason = _reason;
    }

    function donate(string memory _comment) public payable onlyBeforeDeadline {
        if (msg.value <= 0) {
            revert DonationTooLow();
        }

        if(administrationContract.userStatus(msg.sender) == UserStatus.Blocked) {
            donations.push(Donation(msg.value, "", address(0)));
            emit DonationReceived(address(0), msg.value, "");
        } else {
            donations.push(Donation(msg.value, _comment, msg.sender));
            emit DonationReceived(msg.sender, msg.value, _comment);
        }
        
        totalDonations += msg.value;
    }

    function getAllDonations()
        public
        view
        returns (Donation[] memory)
    {
        return donations;
    }

    function comment(string memory _comment) public onlyBeforeDeadline notBlocked {
        comments.push(Comment(_comment, msg.sender));
        emit CommentCreated(msg.sender, _comment);
    }

    function getAllComments()
        public
        view
        returns (Comment[] memory)
    {
        return comments;
    }

    function withdrawFunds() public onlyBeneficiary {
        if (totalDonations < goal) {
            if(block.timestamp <= deadline) {
                revert DeadlineNotPassed();
            }
            revert GoalNotMet();
        }
        emit FundsWithdrawn(address(this).balance, block.timestamp);
        status = FundraiserStatus.FINISHED;
        beneficiary.transfer(address(this).balance);
    }

    function canWithdraw() public view returns (bool) {
        return (totalDonations >= goal || block.timestamp >= deadline) && msg.sender == beneficiary;
    }

    function getDetails()
        public
        view
        returns (
            FundraiserStatus,
            address,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            string memory,
            string memory,
            string memory,
            string memory
        )
    {
        return (
            status,
            beneficiary,
            goal,
            deadline,
            createdAt,
            totalDonations,
            address(this).balance,
            title,
            description,
            uri,
            declineReason
        );
    }
}
