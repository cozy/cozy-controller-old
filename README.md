# Cozy Controller

The Cozy Controller is used to fetch and manage the applications in your Cozy. 

The Cozy Controller is a clone of [Haibu](https://github.com/nodejitsu/haibu)
by [Nodejistu](https://www.nodejitsu.com/) augmented with features required by
the Cozy use cases, like:

* configurable application directory
* configurable application file permissions
* brunch client build command
* update application via a pull
* 

If you want further details, check out the 
[wiki](https://github.com/mycozycloud/cozy-controller/wiki) or 
[Haibu original documentation](https://github.com/nodejitsu/haibu/blob/master/README.md)

Installation:

    npm install cozy-controller -g

Run following command to see all available actions:

    cozy-controller --help

You can specify options in file configuration located at /etc/cozy/cozy-controller.conf
Options available :

* npm-registry: registry used for npm
* strict-ssl: option strict-ssl for npm
* timeout-autostart-home: maximum time between applications starting and home starting during autostart
* timeout-autostart-ds: time to consider data-system broken during autostart

# About Cozy

This app is suited to be deployed on the Cozy platform. Cozy is the personal
server for everyone. It allows you to install your every day web applications
easily on your server, a single place you control. This means you can manage
efficiently your data while protecting your privacy without technical skills.

More informations and hosting services on:
https://cozycloud.cc

# Cozy on IRC

Feel free to check out our IRC channel (#cozycloud on irc.freenode.org) if you
have any technical issues/inquiries or simply to speak about Cozy cloud in
general.
