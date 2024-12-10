// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Fundraiser } from "./Fundraiser.sol";
import { Administration } from "./Administration.sol";
import { UserStatus } from "./UserStatus.sol";
import { FundraiserStatus }  from "./FundraiserStatus.sol";

contract FundraiserFactory {
    Fundraiser[] public fundraisers;
    Administration public administration;

    constructor(address _administrationAddress) {
        administration = Administration(_administrationAddress);
    }

    event FundraiserCreated(address fundraiserAddress, address beneficiary, uint256 goal, uint256 deadline);

    error UserBlocked();

    modifier onlyUnblocked() {
        if (administration.userStatus(msg.sender) == UserStatus.Blocked) {
            revert UserBlocked();
        }
        _;
    }

    function createFundraiser(address payable _beneficiary, uint256 _goal, uint256 _durationInDays, string memory _title, string memory _description, string memory _uri) public onlyUnblocked {
        FundraiserStatus _status;
        if(administration.userStatus(_beneficiary) == UserStatus.Benefactor) {
            _status = FundraiserStatus.APPROVED;
        }
        else {
            _status = FundraiserStatus.PENDING;
        }
        Fundraiser newFundraiser = new Fundraiser(_status, address(administration), _beneficiary, _goal, _durationInDays, _title, _description, _uri);
        fundraisers.push(newFundraiser);

        emit FundraiserCreated(address(newFundraiser), _beneficiary, _goal, block.timestamp + (_durationInDays * 1 days));
    }

    function getFundraisers() public view returns (Fundraiser[] memory) {
        return fundraisers;
    }

    function getFundraiserCount() public view returns (uint256) {
        return fundraisers.length;
    }
}
