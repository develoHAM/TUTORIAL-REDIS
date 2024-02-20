import axios from 'axios';
import cors from 'cors';
import express from 'express';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();
const ENV = process.env;
const clientInfo =
	ENV.NODE_ENV == 'production'
		? {
				password: ENV.REDIS_PW,
				socket: {
					host: ENV.REDIS_HOST,
					port: ENV.REDIS_PORT,
				},
		  }
		: null;

const redisClient = await createClient(clientInfo)
	.on('error', (err) => console.log('Redis Client Error', err))
	.connect();

const DEFAULT_EXPIRATION = 3600;

const app = express();
app.use(cors());

app.get('/photos', async (req, res) => {
	const albumId = req.query.albumId;
	const data = await getOrSetCache(`photos?albumId=${albumId}`, async () => {
		const { data } = await axios.get('https://jsonplaceholder.typicode.com/photos', { params: { albumId } });
		return data;
	});
	return res.json(data);
});

app.get('/photos/:id', async (req, res) => {
	const photoId = req.params.id;
	const data = await getOrSetCache(`photos:${photoId}`, async () => {
		const { data } = await axios.get(`https://jsonplaceholder.typicode.com/photos/${req.params.id}`);
		return data;
	});
	res.json(data);
});

async function getOrSetCache(key, cb) {
	try {
		const cachedData = await redisClient.GET(key);
		console.log('cachedData', cachedData);
		if (!cachedData) {
			const freshData = await cb();
			console.log('freshData', freshData);
			await redisClient.SETEX(key, DEFAULT_EXPIRATION, JSON.stringify(freshData));
			return freshData;
		}
		return JSON.parse(cachedData);
	} catch (error) {
		console.log(error);
	}
}

app.listen(8000);
