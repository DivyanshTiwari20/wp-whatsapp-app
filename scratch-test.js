async function test() {
  const token = 'EAANiApjfrv4BRCZCZACq15F08df7eZB0OcCE5ZCvjDUaQOElZCM1UdDvCbP6awEZClxIAH5NKnFGP1zpisWC7ZCk0ZCMhAXhPnFZA78rkwbtzxkZBanqefALMbZAWUTPFZB7BaHuFZALvrgWDwkLcZBe6Olkyoudf3ZCptxd0Yia3HHzZAKjdraAPULsYm0Sfa8ZA8YGyXgZDZD';
  const phoneId = '1076272248900802';
  const url = `https://graph.facebook.com/v25.0/${phoneId}?access_token=${token}`;

  const res = await fetch(url);
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

test();
