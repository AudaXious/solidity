const { expect } = require('chai');
const { ethers } = require("hardhat");

const d = {
  addedTime: 0,
};

// Start test block
describe('test.js - Airdrop contract testing', function () {
  beforeEach(async function () {
    d.signers = await ethers.getSigners();
    d.owner = d.signers[10];
    d.manager = d.signers[9];
    d.signer = d.signers[8];
    d.creator = d.signers[0];
    d.users = [d.signers[2], d.signers[3], d.signers[4]];
    d.balances = {};
    d.newBalances = {};
    d.now = Math.round(Date.now() / 1000);
    d.tokens = [
      {
        threshold: 100,
        totalAmount: 1000,
        startTime: d.now + 3600,
        endTime: d.now + 3600 * 24 * 30,
      },
      {
        threshold: 160,
        totalAmount: 800,
        startTime: d.now + 3600,
        endTime: d.now + 3600 * 24 * 30,
      }
    ];

    d.AudaXiousAirdrop = await ethers.getContractFactory("AudaXiousAirdrop");
    d.audaXiousAirdrop = await d.AudaXiousAirdrop.connect(d.owner).deploy(
        d.owner.address,
        d.manager.address,
        d.signer.address
    );
    await d.audaXiousAirdrop.deployed();

    await d.audaXiousAirdrop.connect(d.owner).grantRole('MANAGER', d.manager.address);
    await d.audaXiousAirdrop.connect(d.owner).grantRole('SIGNER', d.signer.address);

    d.ERC20Token = await ethers.getContractFactory("ERC20Token");
    for (let i = 0; i < d.tokens.length; i ++) {
      d.tokens[i].contract = await d.ERC20Token.connect(d.owner).deploy(
        d.owner.address,
        `Token ${i + 1}`,
        `Token ${i + 1}`,
        ethers.utils.parseUnits('1000000000')
      );
      await d.tokens[i].contract.deployed();

      await d.tokens[i].contract.connect(d.owner).transfer(
        d.creator.address, ethers.utils.parseUnits(d.tokens[i].totalAmount.toString())
      );
      await d.tokens[i].contract.connect(d.creator).approve(
        d.audaXiousAirdrop.address, ethers.utils.parseUnits(d.tokens[i].totalAmount.toString())
      );
      d.balances.creator = Number(ethers.utils.formatUnits(
        await d.tokens[i].contract.balanceOf(d.creator.address)
      ));
      d.balances.airdrop = Number(ethers.utils.formatUnits(
        await d.tokens[i].contract.balanceOf(d.audaXiousAirdrop.address)
      ));
      await d.audaXiousAirdrop.connect(d.creator).addEvent(
        d.tokens[i].contract.address,
        ethers.utils.parseUnits(d.tokens[i].threshold.toString(), 0),
        ethers.utils.parseUnits(d.tokens[i].totalAmount.toString()),
        d.tokens[i].startTime + d.addedTime,
        d.tokens[i].endTime + d.addedTime,
        []
      );
      expect(Number(ethers.utils.formatUnits(
        await d.tokens[i].contract.balanceOf(d.creator.address)
      ))).to.equal(d.balances.creator - d.tokens[i].totalAmount);
      expect(Number(ethers.utils.formatUnits(
        await d.tokens[i].contract.balanceOf(d.audaXiousAirdrop.address)
      ))).to.equal(d.balances.airdrop + d.tokens[i].totalAmount);

      d.result = await d.audaXiousAirdrop.getEventData(i + 1);
      expect(d.result.creator).to.equal(d.creator.address);
      expect(d.result.contractAddress).to.equal(d.tokens[i].contract.address);
      expect(Number(d.result.numbers[0]))
        .to.equal(d.tokens[i].threshold);
      expect(Number(ethers.utils.formatUnits(d.result.numbers[1])))
        .to.equal(d.tokens[i].totalAmount / d.tokens[i].threshold);
      expect(Number(ethers.utils.formatUnits(d.result.numbers[2])))
        .to.equal(d.tokens[i].totalAmount);
      expect(Number(ethers.utils.formatUnits(d.result.numbers[3]))).to.equal(0);
      expect(Number(d.result.numbers[4])).to.equal(d.tokens[i].startTime + d.addedTime);
      expect(Number(d.result.numbers[5])).to.equal(d.tokens[i].endTime + d.addedTime);
      expect(d.result.activitiesShares.length).to.equal(1);
      expect(d.result.activitiesShares[0]).to.equal(100);
      expect(d.result.active).to.be.true;
    }
  });

  // Test case
  it('Airdrop testing', async function () {
    await expect(
      d.audaXiousAirdrop.connect(d.users[0]).receiveEventEarnings(1, 1, [])
    ).to.be.revertedWith('Event is not started');

    await hre.timeAndMine.increaseTime('1 hour');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });
    d.addedTime += 3600;

    for (let i = 0; i < d.tokens.length; i ++) {
      d.balances[i] = {};
      for (let j = 0; j < d.users.length; j ++) {
        d.balances[i][j] = Number(ethers.utils.formatUnits(
          await d.tokens[i].contract.balanceOf(d.users[j].address)
        ));
        const abiCoder = new ethers.utils.AbiCoder();
        const message = abiCoder.encode(
          ["address", "uint256", "uint8"],
          [d.users[j].address, i + 1, 1]
        );
        let hashedMessage = ethers.utils.keccak256(message);
        let messageHashBinary = ethers.utils.arrayify(hashedMessage);
        d.signature = await d.owner.signMessage(messageHashBinary);
        await expect(
          d.audaXiousAirdrop.connect(d.users[j]).receiveEventEarnings(i + 1, 1, d.signature)
        ).to.be.revertedWith('Signature is not valid');
        await expect(
          d.audaXiousAirdrop.connect(d.users[j]).receiveEventEarnings(i + 1, 1, [])
        ).to.be.revertedWith('ECDSA: invalid signature length');
        d.signature = await d.signer.signMessage(messageHashBinary);
        await d.audaXiousAirdrop.connect(d.users[j]).receiveEventEarnings(i + 1, 1, d.signature);
        await expect(
          d.audaXiousAirdrop.connect(d.users[j]).receiveEventEarnings(i + 1, 1, d.signature)
        ).to.be.revertedWith('Caller already received this activity earnings');
        expect(Number(ethers.utils.formatUnits(
          await d.tokens[i].contract.balanceOf(d.users[j].address)
        ))).to.equal(d.balances[i][j] + d.tokens[i].totalAmount / d.tokens[i].threshold);
      }
    }

    await hre.timeAndMine.increaseTime('30 days');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });
    d.addedTime += 3600 * 24 * 30;

    await expect(
      d.audaXiousAirdrop.connect(d.users[0]).receiveEventEarnings(1, 1, [])
    ).to.be.revertedWith('Event is over');
  });

  it('Withdraw testing', async function () {
    await expect(
      d.audaXiousAirdrop.connect(d.creator).withdrawEventTokens(1)
    ).to.be.revertedWith('Event is not over');

    await hre.timeAndMine.increaseTime('1 hour');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });
    d.addedTime += 3600;

    const abiCoder = new ethers.utils.AbiCoder();
    const message = abiCoder.encode(
      ["address", "uint256", "uint8"],
      [d.users[0].address, 2, 1]
    );
    let hashedMessage = ethers.utils.keccak256(message);
    let messageHashBinary = ethers.utils.arrayify(hashedMessage);
    d.signature = await d.signer.signMessage(messageHashBinary);
    await d.audaXiousAirdrop.connect(d.users[0]).receiveEventEarnings(2, 1, d.signature);

    await expect(
      d.audaXiousAirdrop.connect(d.creator).withdrawEventTokens(1)
    ).to.be.revertedWith('Event is not over');
    await expect(
      d.audaXiousAirdrop.connect(d.creator).withdrawEventTokens(2)
    ).to.be.revertedWith('Event is not over');

    await hre.timeAndMine.increaseTime('30 days');
    await d.signers[0].sendTransaction({
      to: d.signers[0].address,
      value: 0
    });
    d.addedTime += 3600 * 24 * 30;

    d.balances.creator = Number(ethers.utils.formatUnits(
      await d.tokens[0].contract.balanceOf(d.creator.address)
    ));
    d.balances.airdrop = Number(ethers.utils.formatUnits(
      await d.tokens[0].contract.balanceOf(d.audaXiousAirdrop.address)
    ));

    await d.audaXiousAirdrop.connect(d.creator).withdrawEventTokens(1);

    expect(Number(ethers.utils.formatUnits(
      await d.tokens[0].contract.balanceOf(d.creator.address)
    ))).to.equal(d.balances.creator + d.tokens[0].totalAmount);
    expect(Number(ethers.utils.formatUnits(
      await d.tokens[0].contract.balanceOf(d.audaXiousAirdrop.address)
    ))).to.equal(0);

    await expect(
      d.audaXiousAirdrop.connect(d.creator).withdrawEventTokens(1)
    ).to.be.revertedWith('Nothing to withdraw');

    d.balances.creator = Number(ethers.utils.formatUnits(
      await d.tokens[1].contract.balanceOf(d.creator.address)
    ));
    d.balances.airdrop = Number(ethers.utils.formatUnits(
      await d.tokens[1].contract.balanceOf(d.audaXiousAirdrop.address)
    ));

    await d.audaXiousAirdrop.connect(d.creator).withdrawEventTokens(2);

    expect(Number(ethers.utils.formatUnits(
      await d.tokens[1].contract.balanceOf(d.creator.address)
    ))).to.equal(d.balances.creator + d.tokens[1].totalAmount - d.tokens[1].totalAmount / d.tokens[1].threshold);
    expect(Number(ethers.utils.formatUnits(
      await d.tokens[1].contract.balanceOf(d.audaXiousAirdrop.address)
    ))).to.equal(0);

    await expect(
      d.audaXiousAirdrop.connect(d.creator).withdrawEventTokens(2)
    ).to.be.revertedWith('Nothing to withdraw');
  });

  it('Airdrop with more than 1 activity', async function () {
    d.now = Math.round(Date.now() / 1000);
    d.threshold = 10;
    d.totalAmount = 1000;
    d.activitiesShares = [10, 20, 30, 40];
    await d.tokens[0].contract.connect(d.owner).transfer(
      d.creator.address, ethers.utils.parseUnits(d.totalAmount.toString())
    );
    await d.tokens[0].contract.connect(d.creator).approve(
      d.audaXiousAirdrop.address, ethers.utils.parseUnits(d.totalAmount.toString())
    );
    d.tx = await d.audaXiousAirdrop.connect(d.creator).addEvent(
      d.tokens[0].contract.address,
      ethers.utils.parseUnits(d.threshold.toString(), 0),
      ethers.utils.parseUnits(d.totalAmount.toString()),
      1,
      d.now + d.addedTime + 3600,
      d.activitiesShares
    );
    d.tx = await d.tx.wait();
    let eventId;
    d.tx.events.forEach(event => {
      if (event.topics[0] === '0xd6320eb54b473aa4879a4d6a358977f5d9e9596a102603fdf78c296f2d66d0a2') {
        eventId = Number(event.args.eventId);
      }
    });

    const abiCoder = new ethers.utils.AbiCoder();
    const message = abiCoder.encode(
      ["address", "uint256", "uint8"],
      [d.users[1].address, eventId, 1]
    );
    const hashedMessage = ethers.utils.keccak256(message);
    const messageHashBinary = ethers.utils.arrayify(hashedMessage);
    d.signature = await d.signer.signMessage(messageHashBinary);

    await d.audaXiousAirdrop.connect(d.users[1]).receiveEventEarnings(eventId, 1, d.signature);

    for (let i = 2; i <= d.activitiesShares.length; i ++) {
      let abiCoder = new ethers.utils.AbiCoder();
      let message = abiCoder.encode(
        ["address", "uint256", "uint8"],
        [d.users[0].address, eventId, i]
      );
      let hashedMessage = ethers.utils.keccak256(message);
      let messageHashBinary = ethers.utils.arrayify(hashedMessage);
      d.signature = await d.signer.signMessage(messageHashBinary);

      d.balances.user = Number(ethers.utils.formatUnits(
        await d.tokens[0].contract.balanceOf(d.users[0].address)
      ));

      await d.audaXiousAirdrop.connect(d.users[0]).receiveEventEarnings(eventId, i, d.signature);

      expect(Number(ethers.utils.formatUnits(
        await d.tokens[0].contract.balanceOf(d.users[0].address)
      ))).to.equal(d.balances.user + d.totalAmount / d.threshold * d.activitiesShares[i - 1] / 100);

      abiCoder = new ethers.utils.AbiCoder();
      message = abiCoder.encode(
        ["address", "uint256", "uint8"],
        [d.users[1].address, eventId, i]
      );
      hashedMessage = ethers.utils.keccak256(message);
      messageHashBinary = ethers.utils.arrayify(hashedMessage);
      d.signature = await d.signer.signMessage(messageHashBinary);
      await d.audaXiousAirdrop.connect(d.users[1]).receiveEventEarnings(eventId, i, d.signature);
    }
  });

  it('Threshold exceeding', async function () {
    d.now = Math.round(Date.now() / 1000);
    d.threshold = 2;
    d.totalAmount = 1000;
    d.activitiesShares = [10, 20, 30, 40];
    await d.tokens[0].contract.connect(d.owner).transfer(
      d.creator.address, ethers.utils.parseUnits(d.totalAmount.toString())
    );
    await d.tokens[0].contract.connect(d.creator).approve(
      d.audaXiousAirdrop.address, ethers.utils.parseUnits(d.totalAmount.toString())
    );
    d.tx = await d.audaXiousAirdrop.connect(d.creator).addEvent(
      d.tokens[0].contract.address,
      ethers.utils.parseUnits(d.threshold.toString(), 0),
      ethers.utils.parseUnits(d.totalAmount.toString()),
      1,
      d.now + d.addedTime + 3600,
      d.activitiesShares
    );
    d.tx = await d.tx.wait();
    let eventId;
    d.tx.events.forEach(event => {
      if (event.topics[0] === '0xd6320eb54b473aa4879a4d6a358977f5d9e9596a102603fdf78c296f2d66d0a2') {
        eventId = Number(event.args.eventId);
      }
    });

    for (let i = 1; i <= d.activitiesShares.length; i ++) {
      let abiCoder = new ethers.utils.AbiCoder();
      let message = abiCoder.encode(
        ["address", "uint256", "uint8"],
        [d.users[0].address, eventId, i]
      );
      let hashedMessage = ethers.utils.keccak256(message);
      let messageHashBinary = ethers.utils.arrayify(hashedMessage);
      d.signature = await d.signer.signMessage(messageHashBinary);

      await d.audaXiousAirdrop.connect(d.users[0]).receiveEventEarnings(eventId, i, d.signature);

      abiCoder = new ethers.utils.AbiCoder();
      message = abiCoder.encode(
        ["address", "uint256", "uint8"],
        [d.users[1].address, eventId, i]
      );
      hashedMessage = ethers.utils.keccak256(message);
      messageHashBinary = ethers.utils.arrayify(hashedMessage);
      d.signature = await d.signer.signMessage(messageHashBinary);

      await d.audaXiousAirdrop.connect(d.users[1]).receiveEventEarnings(eventId, i, d.signature);

      abiCoder = new ethers.utils.AbiCoder();
      message = abiCoder.encode(
        ["address", "uint256", "uint8"],
        [d.users[2].address, eventId, i]
      );
      hashedMessage = ethers.utils.keccak256(message);
      messageHashBinary = ethers.utils.arrayify(hashedMessage);
      d.signature = await d.signer.signMessage(messageHashBinary);

      await expect(
        d.audaXiousAirdrop.connect(d.users[2]).receiveEventEarnings(eventId, i, d.signature)
      ).to.be.revertedWith('Maximum users number exceeded');
    }
  });
});

function roundTo(a, b) {
  a = Number(a);
  b = Number(b);
  if (isNaN(a) || !(b > 0)) return null;
  b = 10 ** b;
  return Math.round(a * b) / b;
}