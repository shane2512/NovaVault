// API route to get transaction history
import { NextRequest, NextResponse } from 'next/server';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const walletId = searchParams.get('walletId');

  if (!walletId) {
    return NextResponse.json(
      { error: 'Missing walletId parameter' },
      { status: 400 }
    );
  }

  try {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
      return NextResponse.json(
        { error: 'Circle credentials not configured' },
        { status: 500 }
      );
    }

    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    const transactions = await client.listTransactions({
      walletIds: [walletId],
      pageSize: 20,
    });

    return NextResponse.json({
      transactions: transactions.data?.transactions || [],
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
