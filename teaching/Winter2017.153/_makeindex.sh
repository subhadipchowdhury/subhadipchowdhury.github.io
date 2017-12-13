#!/bin/sh

ls | egrep '(pdf)' | perl -e '  use Cwd; $cwd =cwd(); $dir= pop @{[split m|/|, $cwd]}; print "--- \n layout:default \n category:coursepage \n title: $dir \n--- \n \n ";  while(<>) { chop $_; print "+ [$_]($_) \n";}' > index.md
