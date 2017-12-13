#!/bin/sh

ls | egrep '(pdf)' | perl -e 'print "<html> \n <body> \n <ul>"; while(<>) { chop $_; print "<li><a href=\"$_\">$_</a></li>";} print "</ul> \n </body> \n </html>"' > index.html
