// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
import './common/AccessControl.sol';
import './common/Utils.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import 'hardhat/console.sol';



/**
 * @dev Sale contract,
 * functions names are self explanatory
 */
contract AudaXiousAirdrop is AccessControl, Utils {
    using ECDSA for bytes32;

    event EventEarningsReceived(address receiver, uint256 eventId, uint8 activityId, uint256 amount);
    event EventCreated(address creator, uint256 eventId);

    struct Event {
        address creator;
        address contractAddress;
        uint256 threshold; // maximum number of users per activity
        uint256 amountPerEvent; // amount of tokens per event = totalAmount / threshold
        uint256 totalAmount; // total amount of tokens
        uint256 totalDistributed;  // total amount of distributed tokens
        uint256 startTime;
        uint256 endTime;
        uint8[] activitiesShares;
        bool active;
    }

    mapping (uint256 => Event) internal _events;
    uint256 internal _eventsNumber;
    mapping (address => mapping(uint256 => uint256)) internal _userEventIds;
    mapping (address => uint256) internal _userEventsNumber;
    mapping (uint256 => mapping(uint8 => uint256)) internal _usersPerActivity;
    // event id => activity id => number of users who already received earnings
    mapping (address => mapping(uint256 => mapping(uint8 => bool))) internal _earningsReceived;
    // user address => event id => activity id => is received

    bytes32 internal constant MANAGER = keccak256(abi.encode('MANAGER'));
    bytes32 internal constant SIGNER = keccak256(abi.encode('SIGNER'));

    /**
     * @dev constructor
     */
    constructor (
        address ownerAddress,
        address managerAddress,
        address signerAddress
    ) {
        require(ownerAddress != address(0), 'ownerAddress can not be zero');
        require(managerAddress != address(0), 'managerAddress can not be zero');
        require(signerAddress != address(0), 'managerAddress can not be zero');
        _owner = ownerAddress;
        _grantRole(MANAGER, managerAddress);
        _grantRole(SIGNER, signerAddress);
    }

    function receiveEventEarnings (
        uint256 eventId,
        uint8 activityId,
        bytes memory signature
    ) external returns (bool) {
        require(_events[eventId].active, 'Event is not active');
        require(
            activityId >= 1 && activityId <= _events[eventId].activitiesShares.length,
                'activityId is not valid'
        );
        require(
            _events[eventId].startTime <= block.timestamp,
                'Event is not started'
        );
        require(
            _events[eventId].endTime > block.timestamp,
                    'Event is over'
        );
        require(
            verifySignature(msg.sender, eventId, activityId, signature),
            'Signature is not valid'
        );
        require(
            !_earningsReceived[msg.sender][eventId][activityId],
                'Caller already received this activity earnings'
        );
        require(
            _usersPerActivity[eventId][activityId] < _events[eventId].threshold,
                'Maximum users number exceeded'
        );
        _usersPerActivity[eventId][activityId] ++;
        uint256 amount = _events[eventId].amountPerEvent
            * _events[eventId].activitiesShares[activityId - 1] / 100;
        uint256 remains = _events[eventId].totalAmount - _events[eventId].totalDistributed;
        if (amount > remains) amount = remains;
        require(amount > 0, 'Nothing to withdraw');

        _earningsReceived[msg.sender][eventId][activityId] = true;
        _events[eventId].totalDistributed += amount;
        _sendAsset(
            _events[eventId].contractAddress,
            msg.sender,
            amount
        );
        emit EventEarningsReceived(msg.sender, eventId, activityId, amount);
        return true;
    }

    function verifySignature (
        address sender,
        uint256 eventId,
        uint8 activityId,
        bytes memory signature
    ) public view returns (bool) {
        bytes memory message = abi.encode(sender, eventId, activityId);
        address signer = keccak256(message)
            .toEthSignedMessageHash()
            .recover(signature);
        return _checkRole(SIGNER, signer);
    }

    function addEvent (
        address contractAddress,
        uint256 threshold,
        uint256 totalAmount,
        uint256 startTime,
        uint256 endTime,
        uint8[] memory activitiesShares
    ) external returns (bool) {
        require(startTime > 0, 'startTime should be greater than 0');
        require(endTime > startTime, 'endTime should be greater than startTime');
        require (totalAmount > threshold, 'totalAmount should be greater than threshold');
        if (activitiesShares.length > 0) {
            require(activitiesShares.length <= 255, 'Too many activities');
            uint8 sharesSum;
            for (uint8 i = 0; i < activitiesShares.length; i ++) {
                sharesSum += activitiesShares[i];
            }
            require(sharesSum == 100, 'activitiesShares should be 100 in total');
        } else {
            activitiesShares = new uint8[](1);
            activitiesShares[0] = 100;
        }
        _takeAsset(
           contractAddress, msg.sender, totalAmount
        );
        _eventsNumber ++;
        _events[_eventsNumber].creator = msg.sender;
        _events[_eventsNumber].contractAddress = contractAddress;
        _events[_eventsNumber].amountPerEvent = totalAmount / threshold;
        _events[_eventsNumber].threshold = threshold;
        _events[_eventsNumber].totalAmount = totalAmount;
        _events[_eventsNumber].startTime = startTime;
        _events[_eventsNumber].endTime = endTime;
        _events[_eventsNumber].activitiesShares = activitiesShares;
        _events[_eventsNumber].active = true;
        emit EventCreated(msg.sender, _eventsNumber);
        return true;
    }

    function getEventStatus (
        uint256 eventId
    ) external view returns (bool) {
        return _events[eventId].active;
    }

    function setEventStatus (
        uint256 eventId,
        bool active
    ) external returns (bool) {
        require(
            _events[eventId].creator == msg.sender,
                'Caller is not an event creator'
        );
        _events[eventId].active = active;
        return true;
    }

    function withdrawEventTokens (
        uint256 eventId
    ) external returns (bool) {
        require(
            _events[eventId].creator == msg.sender,
                'Caller is not an event creator'
        );
        require(
            _events[eventId].endTime < block.timestamp,
                'Event is not over'
        );
        uint256 amount = _events[eventId].totalAmount - _events[eventId].totalDistributed;
        require(amount > 0, 'Nothing to withdraw');
        _events[eventId].totalDistributed += amount;
        _sendAsset(_events[eventId].contractAddress, _events[eventId].creator, amount);
        return true;
    }

    function getEventData (
        uint256 eventId
    ) external view returns (
        address creator,
        address contractAddress,
        uint256[] memory numbers,
        uint8[] memory activitiesShares,
        bool active
    ) {
        uint256[] memory numbers_ = new uint256[](6);
        numbers_[0] = _events[eventId].threshold;
        numbers_[1] = _events[eventId].amountPerEvent;
        numbers_[2] = _events[eventId].totalAmount;
        numbers_[3] = _events[eventId].totalDistributed;
        numbers_[4] = _events[eventId].startTime;
        numbers_[5] = _events[eventId].endTime;
        return (
            _events[eventId].creator,
            _events[eventId].contractAddress,
            numbers_,
            _events[eventId].activitiesShares,
            _events[eventId].active
        );
    }

    function getEventsNumber () external view returns (uint256) {
        return _eventsNumber;
    }

    function getUserEventId (
        address creator,
        uint256 serialNumber
    ) external view returns (uint256) {
        return _userEventIds[creator][serialNumber];
    }

    function getUserEventsNumber (
        address creator
    ) external view returns (uint256) {
        return _userEventsNumber[creator];
    }

    function earningsReceived (
        address userAddress,
        uint256 eventId,
        uint8 activityId
    ) external view returns (bool) {
        return _earningsReceived[userAddress][eventId][activityId];
    }

    function usersPerActivity (
        uint256 eventId,
        uint8 activityId
    ) external view returns (uint256) {
        return _usersPerActivity[eventId][activityId];
    }
}
