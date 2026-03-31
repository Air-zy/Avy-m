const { getFirestore, getApp } = require('./firebaseUtils');

const mainApp = getApp(process.env.avyFirebaseJSON, "firedb1");
const mainFirestore = getFirestore(mainApp);

const statusCollection = mainFirestore.collection('status');
const statusDoc = statusCollection.doc('main');

module.exports = {
    statusDoc
};