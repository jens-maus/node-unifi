#!/usr/bin/env node

import process from 'node:process';
import axios from 'axios';
import {HttpCookieAgent, HttpsCookieAgent} from 'http-cookie-agent/http';
import Unifi from '../unifi.js';

// Get necessary data from cmd-line
const host = process.argv[2]; // Controller host/ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password
const trustedCertificate = process.argv[6]; // Trusted certificate in pem format

const unifi = new Unifi.Controller({
  host,
  port,
  createAxiosInstance({cookies}) {
    return axios.create({
      httpAgent: new HttpCookieAgent({cookies}),
      httpsAgent: new HttpsCookieAgent({cookies, requestCert: true, ca: trustedCertificate}),
    });
  },
});

try {
  // LOGIN
  const loginData = await unifi.login(username, password);
  console.log('login: ' + loginData);
} catch (error) {
  console.log('ERROR: ' + error);
}
