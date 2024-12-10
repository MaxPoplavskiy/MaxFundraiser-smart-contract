import { expect } from "chai";
import { parseEther, Signer, ZeroAddress } from "ethers";
import { ethers } from "hardhat";
import {
  Administration,
  Fundraiser,
  FundraiserFactory,
} from "../typechain-types";

describe("Administration", function () {
  let admin: Signer, user1: Signer, user2: Signer;
  let administration: Administration;

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();

    const Administration = await ethers.getContractFactory("Administration");
    administration = await Administration.deploy();
  });

  describe("createBenefactorRequest", function () {
    it("should allow a user to create a benefactor request", async function () {
      const comment = "I want to become a benefactor";
      await administration.connect(user1).createBenefactorRequest(comment);

      const request = await administration.isBenefactorRequestSent(
        await user1.getAddress()
      );
      expect(request.comment).to.equal(comment);
      expect(request.status).to.equal(0);
    });

    it("should revert if a request is already sent by the user", async function () {
      const comment = "I want to become a benefactor";
      await administration.connect(user1).createBenefactorRequest(comment);

      await expect(
        administration.connect(user1).createBenefactorRequest(comment)
      ).to.be.rejectedWith("RequestAlreadySent");
    });
  });

  describe("blockUser and unblockUser", function () {
    it("should block and unblock a user", async function () {
      await administration.connect(admin).blockUser(await user1.getAddress());
      let userStatus = await administration.userStatus(
        await user1.getAddress()
      );
      expect(userStatus).to.equal(1);

      await administration.connect(admin).unblockUser(await user1.getAddress());
      userStatus = await administration.userStatus(await user1.getAddress());
      expect(userStatus).to.equal(0);
    });
  });

  describe("giveBenefactorToLast", function () {
    it("should give benefactor status to the last request", async function () {
      const comment = "I want to become a benefactor";
      await administration.connect(user1).createBenefactorRequest(comment);
      await administration.connect(admin).giveBenefactorToLast();

      const userStatus = await administration.userStatus(
        await user1.getAddress()
      );
      expect(userStatus).to.equal(2);
    });
  });

  describe("declineBenefactorToLast", function () {
    it("should decline the last benefactor request and update status", async function () {
      const comment = "I want to become a benefactor";
      await administration.connect(user1).createBenefactorRequest(comment);
      const reason = "Not eligible";
      await administration.connect(admin).declineBenefactorToLast(reason);

      const request = await administration.isBenefactorRequestSent(
        await user1.getAddress()
      );
      expect(request.status).to.equal(2);
      expect(request.declineReason).to.equal(reason);
    });
  });

  describe("onlyAdmin modifier", function () {
    it("should revert if a non-admin calls a restricted function", async function () {
      await expect(
        administration.connect(user1).blockUser(await user2.getAddress())
      ).to.be.rejectedWith("OnlyAdmin");

      await expect(
        administration.connect(user1).unblockUser(await user2.getAddress())
      ).to.be.rejectedWith("OnlyAdmin");
    });

    it("should allow the admin to call restricted functions", async function () {
      await expect(
        administration.connect(admin).blockUser(await user2.getAddress())
      ).to.not.be.reverted;

      await expect(
        administration.connect(admin).unblockUser(await user2.getAddress())
      ).to.not.be.reverted;
    });
  });
});

describe("FundraiserFactory", function () {
  let admin: Signer, user1: Signer, user2: Signer;
  let administration: Administration, fundraiserFactory: FundraiserFactory;
  let initialBlockTimestamp: number;

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();

    const Administration = await ethers.getContractFactory("Administration");
    const FundraiserFactory =
      await ethers.getContractFactory("FundraiserFactory");

    administration = await Administration.deploy();

    fundraiserFactory = await FundraiserFactory.deploy(
      await administration.getAddress()
    );

    initialBlockTimestamp =
      (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;
  });

  describe("createFundraiser", function () {
    it("should allow an unblocked user to create a fundraiser", async function () {
      const beneficiary = await user1.getAddress();
      const goal = parseEther("100");
      const durationInDays = 30;
      const title = "Fundraiser for Charity";
      const description = "A fundraising campaign for a good cause";
      const uri = "https://example.com/charity";

      await expect(
        fundraiserFactory
          .connect(user1)
          .createFundraiser(
            beneficiary,
            goal,
            durationInDays,
            title,
            description,
            uri
          )
      ).to.not.rejected;
    });

    it("should revert if a blocked user tries to create a fundraiser", async function () {
      const beneficiary = await user1.getAddress();
      const goal = parseEther("100");
      const durationInDays = 30;
      const title = "Fundraiser for Charity";
      const description = "A fundraising campaign for a good cause";
      const uri = "https://example.com/charity";

      await administration.connect(admin).blockUser(await user2.getAddress());

      await expect(
        fundraiserFactory
          .connect(user2)
          .createFundraiser(
            beneficiary,
            goal,
            durationInDays,
            title,
            description,
            uri
          )
      ).to.be.rejectedWith("UserBlocked");
    });

    it("should store the new fundraiser in the fundraisers array", async function () {
      const initialFundraiserCount =
        await fundraiserFactory.getFundraiserCount();

      const beneficiary = await user1.getAddress();
      const goal = parseEther("100");
      const durationInDays = 30;
      const title = "Fundraiser for Charity";
      const description = "A fundraising campaign for a good cause";
      const uri = "https://example.com/charity";

      await fundraiserFactory
        .connect(user1)
        .createFundraiser(
          beneficiary,
          goal,
          durationInDays,
          title,
          description,
          uri
        );

      const finalFundraiserCount = await fundraiserFactory.getFundraiserCount();
      expect(finalFundraiserCount).to.equal(initialFundraiserCount + BigInt(1));

      const fundraisers = await fundraiserFactory.getFundraisers();
      expect(fundraisers.length).to.equal(finalFundraiserCount);
    });
  });

  describe("Fundraiser creation event", function () {
    it("should emit the FundraiserCreated event correctly", async function () {
      const beneficiary = await user1.getAddress();
      const goal = parseEther("100");
      const durationInDays = 30;
      const title = "Fundraiser for Charity";
      const description = "A fundraising campaign for a good cause";
      const uri = "https://example.com/charity";

      await expect(
        fundraiserFactory
          .connect(user1)
          .createFundraiser(
            beneficiary,
            goal,
            durationInDays,
            title,
            description,
            uri
          )
      ).to.not.rejected;
    });
  });

  describe("getFundraisers", function () {
    it("should return the correct list of fundraisers", async function () {
      const beneficiary1 = await user1.getAddress();
      const goal1 = parseEther("100");
      const durationInDays1 = 30;
      const title1 = "Fundraiser for Cause 1";
      const description1 = "A fundraiser for a good cause 1";
      const uri1 = "https://example.com/cause1";

      const beneficiary2 = await user2.getAddress();
      const goal2 = parseEther("200");
      const durationInDays2 = 60;
      const title2 = "Fundraiser for Cause 2";
      const description2 = "A fundraiser for a good cause 2";
      const uri2 = "https://example.com/cause2";

      await fundraiserFactory
        .connect(user1)
        .createFundraiser(
          beneficiary1,
          goal1,
          durationInDays1,
          title1,
          description1,
          uri1
        );
      await fundraiserFactory
        .connect(user2)
        .createFundraiser(
          beneficiary2,
          goal2,
          durationInDays2,
          title2,
          description2,
          uri2
        );

      const fundraisers = await fundraiserFactory.getFundraisers();
      expect(fundraisers.length).to.equal(2);
      expect(fundraisers[0]).to.not.equal(fundraisers[1]);
    });
  });
});

describe("Fundraiser", function () {
  let admin: Signer, user1: Signer, user2: Signer, beneficiary: Signer;
  let administration: Administration, fundraiser: Fundraiser;
  let initialBlockTimestamp: number;

  beforeEach(async function () {
    [admin, user1, user2, beneficiary] = await ethers.getSigners();

    const Administration = await ethers.getContractFactory("Administration");
    const Fundraiser = await ethers.getContractFactory("Fundraiser");

    administration = await Administration.deploy();

    const goal = parseEther("100");
    const durationInDays = 30;
    const title = "Fundraiser for Charity";
    const description = "A fundraising campaign for a good cause";
    const uri = "https://example.com/charity";

    fundraiser = await Fundraiser.deploy(
      0,
      await administration.getAddress(),
      await beneficiary.getAddress(),
      goal,
      durationInDays,
      title,
      description,
      uri
    );

    initialBlockTimestamp =
      (await ethers.provider.getBlock("latest"))?.timestamp ?? 0;
  });

  describe("Donation", function () {
    it("should allow a non-blocked user to donate", async function () {
      const donationAmount = parseEther("1");
      const comment = "Great cause!";

      await expect(
        fundraiser.connect(user1).donate(comment, { value: donationAmount })
      )
        .to.emit(fundraiser, "DonationReceived")
        .withArgs(await user1.getAddress(), donationAmount, comment);

      const donations = await fundraiser.getAllDonations();
      expect(donations.length).to.equal(1);
      expect(donations[0].amount).to.equal(donationAmount);
      expect(donations[0].sender).to.equal(await user1.getAddress());
      expect(donations[0].comment).to.equal(comment);
    });

    it("should revert when a blocked user tries to donate", async function () {
      await administration.connect(admin).blockUser(await user2.getAddress());

      const donationAmount = parseEther("1");

      await expect(
        fundraiser
          .connect(user2)
          .donate("Blocked user donation", { value: donationAmount })
      )
        .to.emit(fundraiser, "DonationReceived")
        .withArgs(ZeroAddress, donationAmount, "");
    });

    it("should revert if the donation amount is 0", async function () {
      await expect(
        fundraiser.connect(user1).donate("Zero donation", { value: 0 })
      ).to.be.rejectedWith("DonationTooLow");
    });
  });

  describe("Comment", function () {
    it("should allow a non-blocked user to comment", async function () {
      const comment = "This is a great cause!";

      await expect(fundraiser.connect(user1).comment(comment))
        .to.emit(fundraiser, "CommentCreated")
        .withArgs(await user1.getAddress(), comment);

      const comments = await fundraiser.getAllComments();
      expect(comments.length).to.equal(1);
      expect(comments[0].comment).to.equal(comment);
      expect(comments[0].sender).to.equal(await user1.getAddress());
    });

    it("should revert if a blocked user tries to comment", async function () {
      await administration.connect(admin).blockUser(await user2.getAddress());

      const comment = "Blocked user comment";

      await expect(
        fundraiser.connect(user2).comment(comment)
      ).to.be.rejectedWith("UserBlocked");
    });
  });

  describe("Approval and Decline", function () {
    it("should allow admin to approve a fundraiser", async function () {
      await expect(fundraiser.connect(admin).approve()).to.not.rejected;
    });

    it("should allow admin to decline a fundraiser with a reason", async function () {
      const reason = "Not enough donations";

      await expect(fundraiser.connect(admin).decline(reason)).to.not.rejected;

      const details = await fundraiser.getDetails();
      expect(details[10]).to.equal(reason);
    });

    it("should revert if the reason for decline is too short", async function () {
      await expect(fundraiser.connect(admin).decline("")).to.be.rejectedWith(
        "ReasonTooShort"
      );
    });

    it("should revert if the reason for decline is too long", async function () {
      const longReason = "a".repeat(201);

      await expect(
        fundraiser.connect(admin).decline(longReason)
      ).to.be.rejectedWith("ReasonTooLong");
    });
  });

  describe("Withdraw Funds", function () {
    it("should allow beneficiary to withdraw funds if the goal is met", async function () {
      const donationAmount = parseEther("100");
      await fundraiser
        .connect(user1)
        .donate("Great cause!", { value: donationAmount });

      await expect(fundraiser.connect(beneficiary).withdrawFunds()).to.not
        .rejected;
    });

    it("should revert if the goal is not met", async function () {
      const donationAmount = parseEther("50");
      await fundraiser
        .connect(user1)
        .donate("Partial donation", { value: donationAmount });

      const twoMonthsInSeconds = 60 * 60 * 24 * 30 * 2;
      await ethers.provider.send("evm_increaseTime", [twoMonthsInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        fundraiser.connect(beneficiary).withdrawFunds()
      ).to.be.rejectedWith("GoalNotMet");
    });

    it("should revert if not called by the beneficiary", async function () {
      await expect(
        fundraiser.connect(user1).withdrawFunds()
      ).to.be.rejectedWith("NotBeneficiary");
    });

    it("should revert if the deadline has not passed", async function () {
      const donationAmount = 1;
      await fundraiser
        .connect(user1)
        .donate("Final donation", { value: donationAmount });

      await expect(
        fundraiser.connect(beneficiary).withdrawFunds()
      ).to.be.rejectedWith("DeadlineNotPassed");
    });

    it("should revert if the deadline has passed but goal is not met", async function () {
      const donationAmount = parseEther("50");
      await fundraiser
        .connect(user1)
        .donate("Donation under goal", { value: donationAmount });

      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        fundraiser.connect(beneficiary).withdrawFunds()
      ).to.be.rejectedWith("GoalNotMet");
    });
  });

  describe("Upvote", function () {
    it("should allow users to upvote a fundraiser", async function () {
      await expect(fundraiser.connect(user1).toggleUpvote())
        .to.emit(fundraiser, "UpvoteToggled")
        .withArgs(await user1.getAddress(), true);

      const upvoteCount = await fundraiser.upvoteCount();
      expect(upvoteCount).to.equal(1);
    });

    it("should allow users to remove their upvote", async function () {
      await fundraiser.connect(user1).toggleUpvote();
      await expect(fundraiser.connect(user1).toggleUpvote())
        .to.emit(fundraiser, "UpvoteToggled")
        .withArgs(await user1.getAddress(), false);

      const upvoteCount = await fundraiser.upvoteCount();
      expect(upvoteCount).to.equal(0);
    });
  });
});
