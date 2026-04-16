async function checkWABA() {
  const token = 'EAANiApjfrv4BRCZCZACq15F08df7eZB0OcCE5ZCvjDUaQOElZCM1UdDvCbP6awEZClxIAH5NKnFGP1zpisWC7ZCk0ZCMhAXhPnFZA78rkwbtzxkZBanqefALMbZAWUTPFZB7BaHuFZALvrgWDwkLcZBe6Olkyoudf3ZCptxd0Yia3HHzZAKjdraAPULsYm0Sfa8ZA8YGyXgZDZD';
  const url = `https://graph.facebook.com/v25.0/1076272248900802?fields=name_status,status,quality_rating,account_mode&access_token=${token}`;

  const res = await fetch(url);
  const data = await res.json();
  console.log("Phone Data:", JSON.stringify(data, null, 2));
}
checkWABA();
