import { time, loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { describe } from "mocha";

describe("SBT Bank", function () {
  const wei = ethers.BigNumber.from(10).pow(18);

  async function deployToken() {
    const inititalSupply = "1000000000000000000000";
    const Token = await ethers.getContractFactory("SBToken");
    const token = await Token.deploy(inititalSupply);

    return { token, inititalSupply };
  };

  async function deployBank(tokenAddress:string) {
    const Bank = await ethers.getContractFactory("Bank");
    const bank = await Bank.deploy(tokenAddress);

    return { bank, tokenAddress };
  };

  describe("Deployment", function () {
    context("SB Token", function () {
      it("Should set the right initial supply", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
  
        const ownerBalance = await token.balanceOf(owner.address);
  
        expect(await token.totalSupply()).to.equal(ownerBalance);
      });

      it("Should be able to faucet",async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
  
        const faucetAmount = "100"
        await token.connect(addr1).faucet(faucetAmount);
        const addr1Balance = await token.balanceOf(addr1.address);
  
        expect(addr1Balance).to.equal(faucetAmount);
      })
    });

    context("Bank", function () {
      it("Should set the right token", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);
  
        expect(await bank.token()).to.equal(token.address);
      });

      it("Should deposit token", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(10).mul(wei);

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await bank.connect(addr1).deposit(depositAmount);

        expect(await token.balanceOf(bank.address)).to.equal(depositAmount);
        expect(await token.balanceOf(addr1.address)).to.equal(faucetAmount.sub(depositAmount))
      });

      it("Should get interest when deposit token again", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(10).mul(wei);
        const mineAmount = 10;

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await bank.connect(addr1).deposit(depositAmount);
        await mine(mineAmount);
        await bank.connect(addr1).deposit(depositAmount);
        const balance = await (await bank.balanceByAddress(addr1.address)).amount;
        // First block is 1
        const interest = depositAmount.mul(mineAmount+1).div(10000);

        expect(balance).to.equal(depositAmount.add(interest).add(depositAmount));
      });

      it("Should withdraw token", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(7).mul(wei);
        const withdrawAmount = ethers.BigNumber.from(3).mul(wei);
        const mineAmount = 10;

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await bank.connect(addr1).deposit(depositAmount);
        await mine(mineAmount)
        await bank.connect(addr1).withdraw(withdrawAmount);
        const interest = depositAmount.mul(mineAmount+1).div(10000);

        expect(await token.balanceOf(bank.address)).to.equal(depositAmount.sub(withdrawAmount));
        expect(await token.balanceOf(addr1.address)).to.equal(faucetAmount.sub(depositAmount).add(withdrawAmount));
        expect(await (await bank.balanceByAddress(addr1.address)).amount).to.equal(depositAmount.add(interest).sub(withdrawAmount));
      });

      it("Should withdraw all token", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(10).mul(wei);
        const borrowAmount = ethers.BigNumber.from(5).mul(wei);
        const mineAmount = 10;

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await token.connect(addr2).faucet(faucetAmount);
        await token.connect(addr2).approve(bank.address, inititalSupply);
        const preBlockNum = await ethers.provider.getBlockNumber();
        await bank.connect(addr1).deposit(depositAmount);
        await bank.connect(addr2).loanBorrow(borrowAmount);
        await mine(mineAmount)
        await bank.connect(addr2).loanReturn();
        const postBlockNum = await ethers.provider.getBlockNumber();
        const deltaTime = postBlockNum - preBlockNum;
        const interest = depositAmount.mul(deltaTime).div(10000);
        
        const withdrawAmount = depositAmount.add(interest);
        await bank.connect(addr1).withdraw(withdrawAmount);
        
        expect(await token.balanceOf(addr1.address)).to.equal(faucetAmount.add(interest));
      });

      it("Should throw error withdraw more than deposit", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(7).mul(wei);
        const withdrawAmount = ethers.BigNumber.from(10).mul(wei);

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await bank.connect(addr1).deposit(depositAmount);
        await expect(bank.connect(addr1).withdraw(withdrawAmount)).to.be.rejectedWith("Withdraw amount more than deposited");
      });


      it("Should give loan", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(50).mul(wei);
        const borrowAmount = ethers.BigNumber.from(20).mul(wei);

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, faucetAmount);
        await bank.connect(addr1).deposit(depositAmount);
        await bank.connect(addr2).loanBorrow(borrowAmount)

        expect(await token.balanceOf(bank.address)).to.equal(depositAmount.sub(borrowAmount));
        expect(await token.balanceOf(addr2.address)).to.equal(borrowAmount);
      });

      it("Should throw not enough money to loan", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(50).mul(wei);
        const borrowAmount = ethers.BigNumber.from(30).mul(wei);

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, faucetAmount);
        await bank.connect(addr1).deposit(depositAmount);
        await expect(bank.connect(addr2).loanBorrow(borrowAmount)).to.be.rejectedWith("Not enough fund in the bank");
      });

      it("Should throw already loan", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(50).mul(wei);
        const borrowAmount = ethers.BigNumber.from(10).mul(wei);

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, faucetAmount);
        await bank.connect(addr1).deposit(depositAmount);
        await bank.connect(addr2).loanBorrow(borrowAmount);
        await expect(bank.connect(addr2).loanBorrow(borrowAmount)).to.be.rejectedWith("Already loaned");
      });

      it("Should return loan", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(50).mul(wei);
        const borrowAmount = ethers.BigNumber.from(20).mul(wei);
        const mineAmount = 10;

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await token.connect(addr2).faucet(faucetAmount);
        await token.connect(addr2).approve(bank.address, faucetAmount);
        await bank.connect(addr1).deposit(depositAmount);
        const preBlockNum = await ethers.provider.getBlockNumber();
        await bank.connect(addr2).loanBorrow(borrowAmount);
        await mine(mineAmount);
        const postBlockNum = await ethers.provider.getBlockNumber();
        await bank.connect(addr2).loanReturn();

        const deltaTime = postBlockNum - preBlockNum;
        const interest = borrowAmount.mul(deltaTime).div(1000);
        
        expect(await token.balanceOf(bank.address)).to.equal(depositAmount.add(interest));
        expect(await token.balanceOf(addr2.address)).to.equal(faucetAmount.sub(interest));
      });

      it("Should throw not enough fund to return", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(50).mul(wei);
        const borrowAmount = ethers.BigNumber.from(20).mul(wei);
        const mineAmount = 10;

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await token.connect(addr2).approve(bank.address, faucetAmount);
        await bank.connect(addr1).deposit(depositAmount);
        await bank.connect(addr2).loanBorrow(borrowAmount);
        await mine(mineAmount);
        await expect(bank.connect(addr2).loanReturn()).to.be.rejectedWith("Not enough fund to return");
        
      });

      it("Should throw Bank run", async () => {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const { token, inititalSupply } = await loadFixture(deployToken);
        const { bank, tokenAddress } = await deployBank(token.address);

        const faucetAmount = ethers.BigNumber.from(100).mul(wei);
        const depositAmount = ethers.BigNumber.from(50).mul(wei);
        const withdrawAmount = ethers.BigNumber.from(50).mul(wei); 
        const borrowAmount = ethers.BigNumber.from(25).mul(wei);

        await token.connect(addr1).faucet(faucetAmount);
        await token.connect(addr1).approve(bank.address, inititalSupply);
        await bank.connect(addr1).deposit(depositAmount);
        await bank.connect(addr2).loanBorrow(borrowAmount);
        await token.connect(addr2).approve(bank.address, faucetAmount);

        await expect(bank.connect(addr1).withdraw(withdrawAmount)).to.be.rejectedWith("Bank run!");
      });

    })
    
  })
});