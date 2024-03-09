"use client";

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'

const chainId = 8453; // Arbitrum chain ID
const ERC20ABI = [
    // Read-Only Functions
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",

    // Authenticated Functions
    "function transfer(address to, uint amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

const UniswapV3PriceSetter = () => {
  const [poolAddress, setPoolAddress] = useState('0x9d489b739fa2f1987fc588809d213eaefb372f3b');
  const [targetPrice, setTargetPrice] = useState('200');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currentToken0Reserve, setCurrentToken0Reserve] = useState('');
  const [currentToken1Reserve, setCurrentToken1Reserve] = useState('');
  const [token0, setToken0] = useState({});
  const [token1, setToken1] = useState({});


  useEffect(() => {
    const fetchCurrentPriceAndSymbols = async () => {
      const provider = new ethers.providers.JsonRpcProvider("https://autumn-few-shape.base-mainnet.quiknode.pro/4e7dc9cb673fd2393917d49ddeb31862959ffbc7");
      const poolContract = new ethers.Contract(poolAddress, IUniswapV3PoolABI.abi, provider);

      const token0Address = await poolContract.token0();
      const token1Address = await poolContract.token1();

      // Create ERC-20 contract instances for token0 and token1
      const token0Contract = new ethers.Contract(token0Address, ERC20ABI, provider);
      const token1Contract = new ethers.Contract(token1Address, ERC20ABI, provider);

      // Fetch symbols and decimals for token0 and token1
      const [token0Symbol, token1Symbol, token0Decimals, token1Decimals, token0Reserve, token1Reserve] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol(),
        token0Contract.decimals(),
        token1Contract.decimals(),
        token0Contract.balanceOf(poolAddress),
        token1Contract.balanceOf(poolAddress),
      ]);

      // Assuming 18 decimals for tokens, adjust accordingly
      const token0 = new Token(chainId, token0Address, token0Decimals, token0Symbol);
      const token1 = new Token(chainId, token1Address, token1Decimals, token1Symbol);

      setToken0(token0);
      setToken1(token1);

      const adjustedPrice = token1Reserve / token0Reserve;

      // Depending on your token order, adjust the price calculation
      setCurrentPrice(`1 ${token0.symbol} = ${adjustedPrice.toString()} ${token1.symbol}`);
      setCurrentToken0Reserve(token0Reserve.toString());
      setCurrentToken1Reserve(token1Reserve.toString());

    };

    fetchCurrentPriceAndSymbols();
  }, [poolAddress]);

  function calculateSwapAmount(reserveA, reserveB, targetPrice) {
    //check if targetPrice is a number
    if (isNaN(targetPrice)) {
        targetPrice = Number(targetPrice);
    }
    if (isNaN(targetPrice) || targetPrice <= 0) {
        targetPrice = 1;
    }
    
    // The target price is defined as amountB/amountA for tokenA to tokenB swap
    const currentPrice = reserveB / reserveA;
    if (targetPrice > currentPrice) {
        // We need to increase the price, so we swap tokenA for tokenB
        // Calculate the required reserve ratio to achieve the target price
        const targetReserveB = reserveA * targetPrice;
        // Calculate how much tokenB we need to remove to achieve this ratio
        const tokenBToSwap = BigInt(((reserveB - targetReserveB) / 2) * -1);
        return { tokenAToSwap: 0, tokenBToSwap };
    } else {
        // We need to decrease the price, so we swap tokenB for tokenA
        // Calculate the required reserve ratio to achieve the target price
        const targetReserveA = reserveB / targetPrice;

        // Calculate how much tokenA we need to add to achieve this ratio
        const tokenAToSwap = BigInt((targetReserveA - reserveA) / 2);
        return { tokenAToSwap, tokenBToSwap: 0 };
    }
  }

  let { tokenAToSwap, tokenBToSwap } = calculateSwapAmount(currentToken0Reserve, currentToken1Reserve, targetPrice);

  try {
      tokenAToSwap = ethers.utils.formatEther(String(tokenAToSwap));
  } catch (e) {
      console.log("Error converting swap amounts", e);
  }

  try {
      tokenBToSwap = ethers.utils.formatEther(String(tokenBToSwap));
  } catch (e) {
      console.log("Error converting swap amounts", e);
  }

  if(!currentPrice) {
    return <div className="max-w-md mx-auto bg-white dark:bg-neutral-950 shadow-md rounded-lg p-4 m-8 dark:text-neutral-200">Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-neutral-950 shadow-md rounded-lg p-4 m-8">
      <div className="mb-4">
        <label className="block label">Pool Address:</label>
        <input type="text" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} placeholder="Pool Address" className="text-lg px-3 py-2 bg-gray-100 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md dark:text-gray-100"/>
      </div>
      <p className="label">Current Price: <span className="item">{currentPrice}</span></p>
      <p className="label">Current {token0.symbol} Reserve: <span className="item">{ethers.utils.formatUnits(currentToken0Reserve, token0.decimals)}</span></p>
      <p className="label">Current {token1.symbol} Reserve: <span className="item">{ethers.utils.formatUnits(currentToken1Reserve, token1.decimals)}</span></p>
      <div className="mt-4">
          <label className="block label">Target Price:</label>
          <div className='flex items-center gap-2 label'>
            <input type="text" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="Target Price" className="text-lg px-3 py-2 bg-gray-100 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-md dark:text-gray-100"/>

            <span>= 1 WETH</span> 
          </div>
      </div>
      {targetPrice && (
          <div className="mt-4 bg-gray-100 dark:bg-neutral-900 p-4 rounded-lg">
              <p className="label">{token0.symbol} to SWAP: <span className="item">{tokenAToSwap}</span></p>
              <p className="label">{token1.symbol} to SWAP: <span className="item">{tokenBToSwap}</span></p>
          </div>
      )}
    </div>

  );
};

export default UniswapV3PriceSetter;